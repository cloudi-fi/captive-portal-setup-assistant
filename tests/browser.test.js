"use strict";
/* Browser tests: open index.html in a real Chrome (headless) and drive the form like a user would.
   Run from this folder: npm install, then npm test. Set CHROME_PATH if Chrome is not in the default macOS location. */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const puppeteer = require("puppeteer-core");

const PAGE = pathToFileURL(path.join(__dirname, "..", "index.html")).href;
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const D = "https://login.cloudi-fi.net/start/ch/acme/lh/demo";
const wait = (ms = 400) => new Promise(r => setTimeout(r, ms));

let browser;
before(async () => { browser = await puppeteer.launch({ executablePath: CHROME, headless: true }); });
after(async () => { await browser.close(); });

/* A fresh page per test, with helpers. Fails the test on any console error or uncaught exception. */
async function open(hash = "") {
  const pg = await browser.newPage(), errors = [];
  pg.on("pageerror", e => errors.push(e.message));
  pg.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await pg.setViewport({ width: 1300, height: 1000 });
  await pg.goto(PAGE + hash, { waitUntil: "networkidle0" });
  await wait();
  const h = {
    pg, errors,
    val: s => pg.$eval(s, e => e.value),
    text: s => pg.$eval(s, e => e.textContent),
    hidden: s => pg.$eval(s, e => e.hidden),
    hash: async () => Object.fromEntries(new URLSearchParams(await pg.evaluate(() => location.hash.slice(1)))),
    /* Focus first, as a real click on the menu does. */
    pick: async id => { await pg.focus("#platform"); await pg.select("#platform", id); await wait(); },
    typeUrl: async u => { await pg.focus("#url"); await pg.$eval("#url", e => e.select()); await pg.keyboard.type(u); await wait(); },
    clearUrl: async () => { await pg.focus("#url"); await pg.$eval("#url", e => { e.value = ""; e.dispatchEvent(new Event("input")); }); await wait(); },
    leaveUrl: async () => { await pg.evaluate(() => document.activeElement.blur()); await pg.$eval("#url", e => e.dispatchEvent(new Event("change"))); await wait(); },
    retype: async (sel, v) => { await pg.click(sel, { clickCount: 3 }); await pg.keyboard.type(v); await wait(); },
    done: async () => { assert.deepEqual(errors, [], "console errors"); await pg.close(); }
  };
  return h;
}

test("default page", async () => {
  const t = await open();
  assert.equal(await t.pg.title(), "Cloudi-Fi - Captive Portal Setup Assistant");
  assert.equal(await t.val("#url"), D + "/sp/spcisco.com", "default URL gets the default platform's /sp/");
  assert.equal(await t.val("#ch"), "acme");
  assert.equal(await t.val("#lh"), "demo");
  assert.deepEqual(await t.hash(), { platform: "c9800-local" }, "default link holds only the platform");
  assert.ok(await t.hidden("#urlStatus"), "no status when there is nothing to say");
  assert.ok(await t.hidden("#kbRefresh"), "KB refresh hidden outside claude.ai");
  assert.ok((await t.text("#out")).includes("redirect for-login " + D + "/sp/spcisco.com"));
  await t.clearUrl();
  assert.ok((await t.text("#out")).includes("Waiting for a splash page URL"));
  await t.done();
});

test("splash URL and hashes stay in sync", async () => {
  const t = await open();
  await t.typeUrl("https://login.cloudi-fi.net/start/ch/abc123/lh/loc456/sp/spcisco.com");
  assert.equal(await t.val("#ch"), "abc123", "URL fills the company hash");
  assert.equal(await t.val("#lh"), "loc456", "URL fills the location hash");
  await t.retype("#ch", "NEWCO");
  assert.equal(await t.val("#url"), "https://login.cloudi-fi.net/start/ch/NEWCO/lh/loc456/sp/spcisco.com", "editing a hash updates the URL");
  assert.ok((await t.text("#out")).includes("/ch/NEWCO/"), "output uses the new hash");
  await t.clearUrl();
  assert.equal(await t.val("#ch"), "", "clearing the URL clears the hashes");
  await t.pg.type("#lh", "L1"); await t.pg.type("#ch", "C1"); await t.leaveUrl();
  assert.equal(await t.val("#url"), "https://login.cloudi-fi.net/start/ch/C1/lh/L1/sp/spcisco.com", "URL built from hashes, ch before lh");
  await t.done();
});

test("platform sets the /sp/ value", async () => {
  const t = await open();
  await t.pick("fortios");
  assert.equal(await t.val("#url"), D + "/sp/spforti.com");
  assert.deepEqual(await t.hash(), { platform: "fortios" }, "default URL stays out of the link");
  await t.pick("palo-strata");
  assert.equal(await t.val("#url"), D, "SAML platform drops /sp/");
  assert.ok((await t.text("#urlStatus")).includes("https://login.cloudi-fi.net/start/acme/demo"), "SAML form shown");
  await t.pick("fortios");
  assert.equal(await t.val("#url"), D + "/sp/spforti.com", "back to FortiGate restores its /sp/");
  await t.pick("meraki-api");
  assert.ok(await t.hidden("#urlCard"), "platforms without a portal URL hide the URL card");
  await t.done();
});

test("/sp/ value picks the platform", async () => {
  const t = await open();
  await t.typeUrl(D + "/sp/sparuba.com");
  assert.equal(await t.val("#platform"), "aruba-iap", "switches to the first platform with that /sp/");
  assert.ok((await t.text("#urlStatus")).includes("Platform set to HPE Aruba · Instant AP from /sp/sparuba.com"));
  assert.equal(await t.val("#url"), D + "/sp/sparuba.com", "box untouched while typing");
  await t.pick("aruba-central");
  assert.ok(await t.hidden("#urlStatus"), "picking a platform by hand clears the message");
  await t.pick("c9800-flexls");
  await t.typeUrl(D + "/sp/spcisco.com");
  assert.equal(await t.val("#platform"), "c9800-flexls", "a /sp/ shared with the current platform keeps it");
  await t.typeUrl(D + "/sp/spsomething.com");
  assert.equal(await t.val("#platform"), "c9800-flexls");
  assert.ok((await t.text("#urlStatus")).includes("spsomething.com matches no platform; it becomes /sp/spcisco.com"), "unknown /sp/ warns while typing");
  await t.leaveUrl();
  assert.equal(await t.val("#url"), D + "/sp/spcisco.com", "unknown /sp/ replaced on leaving the box");
  await t.typeUrl("login.cloudi-fi.net/start/ch/zz/lh/yy"); await t.leaveUrl();
  assert.equal(await t.val("#url"), "https://login.cloudi-fi.net/start/ch/zz/lh/yy/sp/spcisco.com", "missing /sp/ and scheme added");
  await t.done();
});

test("Extreme WiNG keeps the URL as pasted", async () => {
  const t = await open();
  await t.pick("extreme-wing");
  assert.equal(await t.val("#url"), D + "/sp/spcisco.com", "URL unchanged when picking WiNG");
  await t.typeUrl(D + "/sp/spforti.com");
  assert.equal(await t.val("#platform"), "extreme-wing", "a pasted /sp/ does not switch away from WiNG");
  await t.done();
});

test("shareable link", async () => {
  const t = await open();
  await t.pick("fortios");
  await t.pg.type("#secret", "s3cr3t"); await t.pg.type("#loc", "Paris");
  await t.retype("#fg_wan", "wan2");
  const h = await t.hash();
  assert.deepEqual(h, { platform: "fortios", loc: "Paris", secret: "s3cr3t", fg_wan: "wan2" }, "only changed values are written");
  const link = await t.pg.evaluate(() => location.href);

  const t2 = await open(link.slice(link.indexOf("#")));
  assert.equal(await t2.val("#platform"), "fortios");
  assert.equal(await t2.val("#fg_wan"), "wan2");
  assert.equal(await t2.val("#secret"), "s3cr3t");
  assert.ok((await t2.text("#out")).includes("set secret s3cr3t"), "restored secret used in the CLI");
  await t2.pick("meraki-api");
  const h2 = await t2.hash();
  assert.ok(!("secret" in h2) && !("url" in h2) && !("fg_wan" in h2), "hidden fields leave the link: " + JSON.stringify(h2));
  await t2.pg.evaluate(u => { location.hash = "#platform=mikrotik&loc=Lyon&url=" + encodeURIComponent(u); }, D.replace("acme", "X"));
  await wait();
  assert.equal(await t2.val("#platform"), "mikrotik", "a new fragment in the address bar reloads the form");
  assert.equal(await t2.val("#ch"), "X");
  assert.equal(await t2.val("#secret"), "", "fields absent from the new link are reset");
  await t2.done();
  await t.done();

  const t3 = await open("#platform=fortios&url=" + encodeURIComponent(D + "/sp/sparuba.com"));
  assert.equal(await t3.val("#platform"), "fortios", "the link's platform wins over its /sp/");
  assert.equal(await t3.val("#url"), D + "/sp/spforti.com");
  await t3.done();
});

test("every platform renders", async () => {
  const t = await open();
  const failing = await t.pg.evaluate(() => P.filter(p => {
    document.getElementById("platform").value = p.id; build();
    return document.getElementById("out").textContent.includes("Generator error");
  }).map(p => p.id));
  assert.deepEqual(failing, []);
  await t.done();
});

test("layout: tooltips and phone width", async () => {
  const t = await open();
  await t.pg.hover("#urlCard .tip");
  assert.equal(await t.pg.$eval("#url-tip", e => getComputedStyle(e).display), "block", "tooltip opens on hover");
  await t.pg.setViewport({ width: 375, height: 800 }); await wait();
  await t.pg.focus("#radCard .tip");
  assert.ok(await t.pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no sideways scrolling at 375px with a tooltip open");
  await t.done();
});

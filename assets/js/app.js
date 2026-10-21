"use strict";
/* UI: form, shareable state in the URL fragment, splash URL parsing, rendering. Loaded last. */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clean = s => String(s || "").trim().replace(/[^A-Za-z0-9_-]+/g, "");
const ORDER = P.map(p => p.vendor).filter((v, i, a) => a.indexOf(v) === i);

/* ---------- UI scaffolding ---------- */
$("platform").innerHTML = ORDER.map(v => '<optgroup label="' + esc(v) + '">' +
  P.filter(p => p.vendor === v).map(p => '<option value="' + p.id + '">' + esc(v + " · " + p.name) + "</option>").join("") + "</optgroup>").join("");
$("vendors").innerHTML = '<label class="chip core"><input type="checkbox" checked disabled><span>Cloudi-Fi required <i id="coreN">0</i></span></label>' +
  VENDORS.map(v => '<label class="chip"><input type="checkbox" id="v_' + v.id + '"><span>' + v.name + " <i>" + v.d.length + "</i></span></label>").join("");

const allFieldDefs = {};
P.forEach(p => p.fields.forEach(f => { allFieldDefs[f.id] = f; }));
const fstate = {};
function fdef(f) { return f.def !== undefined ? f.def : f.type === "check" ? false : f.type === "select" ? f.opts[0][0] : ""; }
function fv(id) {
  const d = allFieldDefs[id];
  if (id in fstate) return fstate[id];
  return d ? fdef(d) : "";
}

/* ---------- Shareable state ----------------------------------------------
   The whole form lives in the URL fragment (#platform=…&loc=…), so a link reproduces the config.
   The fragment is never sent to a server, which is why secrets may travel in it but nowhere else.
   Only values that differ from the defaults, and only fields visible for the current platform, are written. */
const STATIC = ["platform", "url", "loc", "ssid", "vlan", "life", "ckey", "suffix", "region", "radCount", "secret", "gReg", "wg", "tMac", "tIp", "tUser", "tPass"].concat(VENDORS.map(v => "v_" + v.id));
const SECRET_KEYS = ["secret", "tn_psk", "cp_uam", "hw_key"];
const read = el => el.type === "checkbox" ? (el.checked ? "1" : "0") : el.value;
const enc = v => typeof v === "boolean" ? (v ? "1" : "0") : String(v);
const DEFAULTS = {};
STATIC.forEach(id => { DEFAULTS[id] = read($(id)); });

function stateParams() {
  const q = new URLSearchParams(), p = P.find(o => o.id === $("platform").value) || P[0];
  q.set("platform", p.id);
  /* The default URL is compared once given the platform's /sp/, as the box shows it. */
  const def = id => id === "url" ? canonicalUrl(DEFAULTS.url, p) : DEFAULTS[id];
  STATIC.forEach(id => { const el = $(id); if (id !== "platform" && !el.closest("[hidden]") && read(el) !== def(id)) q.set(id, read(el)); });
  p.fields.forEach(f => { const el = $(f.id); if (el && !el.closest("[hidden]") && enc(fv(f.id)) !== enc(fdef(f))) q.set(f.id, enc(fv(f.id))); });
  return q;
}
function shareLink() { return location.href.split("#")[0] + "#" + stateParams().toString(); }
let hashTimer = 0;
function saveState() {
  clearTimeout(hashTimer);
  /* Debounced: Safari throws if replaceState runs more than ~100 times in 10 s, e.g. while typing. */
  hashTimer = setTimeout(() => { try { history.replaceState(null, "", "#" + stateParams().toString()); } catch (e) {} }, 300);
}
function loadState() {
  const q = new URLSearchParams(location.hash.slice(1));
  STATIC.forEach(id => {
    const el = $(id), v = q.has(id) ? q.get(id) : DEFAULTS[id];
    if (el.type === "checkbox") el.checked = v === "1"; else el.value = v;
    if (el.tagName === "SELECT" && !el.value) el.value = DEFAULTS[id];
  });
  Object.keys(fstate).forEach(k => { delete fstate[k]; });
  q.forEach((v, k) => { const d = allFieldDefs[k]; if (d) fstate[k] = d.type === "check" ? v === "1" : v; });
  current = null; urlNote = "";
}

/* Tooltip: a "?" next to a label. The text stays in the DOM so the field can point to it with aria-describedby. */
const tip = (id, text) => text ? '<span class="tip" tabindex="0"><span class="tip-text" role="tooltip" id="' + id + '-tip">' + esc(text) + "</span></span>" : "";
const described = (id, text) => text ? ' aria-describedby="' + id + '-tip"' : "";

function renderFields(p) {
  $("pfTitle").textContent = p.name + " settings";
  $("pfCard").hidden = !p.fields.length;
  $("pfFields").innerHTML = p.fields.map(f => {
    const v = fv(f.id), t = tip(f.id, f.hint), d = described(f.id, f.hint);
    const show = f.showIf ? (fv(f.showIf) ? "" : " hidden") : "";
    if (f.type === "check") return '<div class="lbl" data-f="' + f.id + '"' + show + '><label class="check"><input type="checkbox" id="' + f.id + '"' + d + (v ? " checked" : "") + "> " + esc(f.label) + "</label>" + t + "</div>";
    const head = '<div class="field" data-f="' + f.id + '"' + show + '><div class="lbl"><label for="' + f.id + '">' + esc(f.label) + "</label>" + t + "</div>";
    if (f.type === "select") return head + '<select id="' + f.id + '"' + d + ">" + f.opts.map(o => '<option value="' + o[0] + '"' + (o[0] === (v || f.opts[0][0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select></div>";
    if (f.type === "area") return head + '<textarea id="' + f.id + '"' + d + ' spellcheck="false">' + esc(v) + "</textarea></div>";
    return head + '<input type="' + (f.type === "number" ? "number" : f.type === "password" ? "password" : "text") + '" id="' + f.id + '"' + d + ' spellcheck="false" autocomplete="off" value="' + esc(v) + '"></div>';
  }).join("");
  p.fields.forEach(f => {
    const el = $(f.id);
    const h = () => {
      fstate[f.id] = el.type === "checkbox" ? el.checked : el.value;
      p.fields.filter(g => g.showIf === f.id).forEach(g => { document.querySelector('[data-f="' + g.id + '"]').hidden = !fstate[f.id]; });
      build();
    };
    el.addEventListener("input", h); el.addEventListener("change", h);
  });
}

/* ---------- URL handling ---------- */
function parseUrl(raw, p) {
  const r = { msgs: [] };
  let s = raw.trim().replace(/\s+/g, "");
  if (!s) { r.err = "Paste the splash page URL from the location's menu."; return r; }
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u;
  try { u = new URL(s); } catch (e) { r.err = "That doesn't parse as a URL."; return r; }
  if (!/cloudi-fi\.net$/i.test(u.hostname)) r.msgs.push(["warn", "Host is " + u.hostname + ", not a cloudi-fi.net domain."]);
  if (u.protocol !== "https:") u.protocol = "https:";
  const parts = u.pathname.split("/").filter(Boolean);
  const get = k => { const i = parts.indexOf(k); return i >= 0 && parts[i + 1] ? parts[i + 1] : ""; };
  r.ch = get("ch") || u.searchParams.get("ch") || "";
  r.lh = get("lh") || u.searchParams.get("lh") || "";
  r.spOld = get("sp") || "(none)";
  if (!r.ch || !r.lh) r.msgs.push(["warn", "Couldn't find the ch and lh tokens. Check you copied the splash page URL."]);
  r.host = u.hostname;
  if (p.url === "sp" || p.url === "split") {
    const i = parts.indexOf("sp"); if (i >= 0) parts.splice(i, 2);
    parts.push("sp", p.sp);
    u.pathname = "/" + parts.join("/");
    r.url = u.origin + u.pathname;
    r.path = u.pathname;
  } else if (p.url === "saml2") {
    r.url = "https://" + u.hostname + "/start/" + r.ch + "/" + r.lh; r.note = "This platform uses the SAML SSO form " + r.url;
  } else if (p.url === "saml1") {
    r.url = "https://" + u.hostname + "/start/" + r.ch; r.note = "This platform uses the Versa form " + r.url;
  } else {
    r.url = u.origin + u.pathname; r.path = u.pathname; r.note = "Used as copied (this KB article gives no /sp/ value)";
  }
  if (u.search && (p.url === "sp" || p.url === "split" || p.url === "asis")) r.msgs.push(["warn", "Query string dropped from the copied URL."]);
  return r;
}

/* The /sp/ value of a pasted URL, lower-cased; "" when there is none. */
function spOf(raw) { const m = String(raw).match(/\/sp\/([^/?#\s]+)/i); return m ? m[1].toLowerCase() : ""; }

/* The URL box shows the URL for the selected platform: its /sp/ value, or no /sp/ for the SAML forms.
   WiNG ("asis": the KB says to paste the console URL unchanged) and platforms without a portal URL keep it as is. */
function canonicalUrl(raw, p) {
  if (!["sp", "split", "saml1", "saml2"].includes(p.url)) return raw;
  let s = raw.trim().replace(/\s+/g, ""), u;
  if (!s) return raw;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try { u = new URL(s); } catch (e) { return raw; }
  u.protocol = "https:";
  const parts = u.pathname.split("/").filter(Boolean), i = parts.indexOf("sp");
  if (i >= 0) parts.splice(i, 2);
  if (p.sp) parts.push("sp", p.sp);
  u.pathname = "/" + parts.join("/");
  return u.href;
}

/* Reverse of parseUrl for the two hashes: writes ch / lh back into the pasted URL, keeping the rest of it.
   Starts from https://login.cloudi-fi.net/start when the URL is empty or unreadable. An empty value removes the segment. */
function setTokens(raw, tokens) {
  let s = raw.trim().replace(/\s+/g, ""), u = null;
  if (s && !/^https?:\/\//i.test(s)) s = "https://" + s;
  try { u = s ? new URL(s) : null; } catch (e) {}
  if (!u) u = new URL("https://login.cloudi-fi.net/start");
  const parts = u.pathname.split("/").filter(Boolean);
  ["ch", "lh"].forEach(k => {
    const v = (tokens[k] || "").trim(), i = parts.indexOf(k);
    if (i < 0 && u.searchParams.has(k)) { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k); return; }
    if (i >= 0) { if (v) parts[i + 1] = v; else parts.splice(i, 2); return; }
    if (!v) return;
    /* Keep the console's order: /start/ch/<ch>/lh/<lh>/sp/<sp> */
    const before = ["sp"].concat(k === "ch" ? ["lh"] : []).map(n => parts.indexOf(n)).filter(n => n >= 0);
    parts.splice(before.length ? Math.min.apply(null, before) : parts.length, 0, k, v);
  });
  u.pathname = "/" + parts.join("/");
  return u.href;
}

/* ---------- walled garden ---------- */
function walledGarden(p) {
  const lines = id => $(id).value.split(/\n/).map(x => x.trim()).filter(Boolean);
  const fmt = d => p.wg === "suffix" ? d.replace(/^\*\.?/, "") : d;
  const groups = [["Cloudi-Fi required", (p.core || []).slice()]];
  VENDORS.filter(v => $("v_" + v.id).checked).forEach(v => groups.push([v.name, v.d.concat(v.id === "google" ? lines("gReg") : [])]));
  const extra = lines("wg"); if (extra.length) groups.push(["Custom", extra]);
  const seen = new Set();
  groups.forEach(g => { g[1] = g[1].map(fmt).filter(d => { const k = d.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }); });
  return { groups: groups.filter(g => g[1].length), all: Array.from(seen), count: seen.size };
}

/* ---------- render ---------- */
let lastText = {};
function hl(line, lang) {
  const cm = lang === "ios" ? "!" : "#";
  if (lang !== "html" && lang !== "plain" && line.trimStart().startsWith(cm)) return '<span class="' + (verifyRe.test(line) ? "s" : "c") + '">' + esc(line) + "</span>";
  let s = esc(line).replace(/(https:\/\/[^\s"&]+(?:&amp;[^\s"]*)?)/g, '<span class="v">$1</span>');
  if (lang === "ios") { const m = line.match(/^(\S)/); if (m) s = '<span class="k">' + s + "</span>"; }
  return s;
}
function render(p, res, urlInfo) {
  const out = $("out");
  const kind = res.blocks.some(b => b.kind === "cli") && res.blocks.every(b => b.kind === "cli") ? "CLI" : res.blocks.some(b => b.kind === "cli") ? "CLI + settings" : "Settings sheet";
  let h = '<div class="outhead"><h3>' + esc(p.vendor + " · " + p.name) + '</h3><a class="kb" href="' + KB + p.kb + '" target="_blank" rel="noopener">KB article</a></div>';
  if (res.blocks.some(b => b.kind === "sheet")) h += '<div><button class="light" data-copyall="1">Copy whole sheet as text</button></div>';
  lastText = {};
  res.blocks.forEach((b, i) => {
    if (b.kind === "cli") {
      const txt = b.lines.join("\n"); lastText["b" + i] = txt;
      h += '<div class="term"><div class="termbar"><span class="ttl"><b>' + esc(b.title) + "</b> · " + b.lines.filter(l => !/^\s*[!#]/.test(l)).length + ' lines</span><button class="' + (i === 0 ? "primary" : "ghost") + '" data-copy="b' + i + '">Copy</button></div><pre tabindex="0">' + b.lines.map(l => hl(l, b.lang)).join("\n") + "</pre></div>";
    } else {
      h += '<div class="sheet"><header><h4>' + esc(b.title) + '</h4><span class="path">' + esc(b.path) + '</span></header><div class="tablewrap"><table>';
      b.rows.forEach((r, j) => {
        const key = "b" + i + "r" + j; lastText[key] = r[1];
        const shown = r[2] === "secret" ? "•".repeat(Math.min(16, String(r[1]).length || 8)) : r[1];
        h += '<tr><td class="f">' + esc(r[0]) + '</td><td class="v">' + esc(shown) + '</td><td class="cp"><button class="mini" data-copy="' + key + '">Copy</button></td></tr>';
      });
      h += "</table></div></div>";
    }
  });
  if (res.verify) { lastText.verify = res.verify.join("\n"); h += '<div class="term"><div class="termbar"><span class="ttl"><b>Verify</b></span><button class="ghost" data-copy="verify">Copy</button></div><pre>' + res.verify.map(esc).join("\n") + "</pre></div>"; }
  const notes = (urlInfo && urlInfo.notes || []).concat(res.notes || []);
  if (notes.length) h += '<div class="note"><b>Before you deploy</b><ul>' + notes.map(n => "<li>" + esc(n) + "</li>").join("") + "</ul></div>";
  if (res.ts && res.ts.length) {
    h += '<div class="outhead tshead" id="troubleshooting"><h3>Troubleshooting</h3><button class="light" data-copy="tsall">Copy all checks</button></div>';
    res.ts.forEach((b, i) => {
      const why = b.why ? '<p class="why">' + esc(b.why) + "</p>" : "";
      if (b.kind === "cli") {
        lastText["t" + i] = b.lines.join("\n");
        h += '<div class="term"><div class="termbar"><span class="ttl"><b>' + esc(b.title) + '</b></span><button class="ghost" data-copy="t' + i + '">Copy</button></div>' + (why ? '<div class="termwhy">' + esc(b.why) + "</div>" : "") + '<pre tabindex="0">' + b.lines.map(l => hl(l, b.lang)).join("\n") + "</pre></div>";
      } else {
        h += '<div class="steps"><h4>' + esc(b.title) + "</h4>" + why + "<ul>" + b.lines.map(l => "<li>" + esc(l) + "</li>").join("") + "</ul></div>";
      }
    });
    lastText.tsall = res.ts.map(b => "== " + b.title + " ==\n" + (b.kind === "cli" ? b.lines.join("\n") : b.lines.map(l => "- " + l).join("\n"))).join("\n\n");
  }
  lastText.all = res.blocks.map(b => b.kind === "cli" ? "== " + b.title + " ==\n" + b.lines.join("\n") : "== " + b.title + " (" + b.path + ") ==\n" + b.rows.map(r => r[0] + ": " + r[1]).join("\n")).join("\n\n");
  out.innerHTML = h;
  $("pmeta").innerHTML = '<span class="pill">Output <b>' + kind + "</b></span>" + (p.sp ? '<span class="pill">/sp/ <b>' + esc(p.sp) + "</b></span>" : "") +
    '<span class="pill">RADIUS <b>' + (p.radius ? "yes" : "no") + "</b></span>";
}

function toast(t) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 1800); }
$("out").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const key = b.dataset.copyall ? "all" : b.dataset.copy; const txt = lastText[key]; if (txt === undefined) return;
  try { navigator.clipboard.writeText(txt).then(() => toast("Copied"), () => toast("Copy blocked; select the text instead")); } catch (err) { toast("Copy blocked; select the text instead"); }
});

/* ---------- main build ---------- */
let current = null, urlNote = "";
function build() {
  const p = P.find(q => q.id === $("platform").value) || P[0], box = $("url");
  if (current !== p.id) { current = p.id; renderFields(p); }
  const urlUsed = p.url !== "integ" && p.url !== "none";
  $("urlCard").hidden = !urlUsed;
  $("radCard").hidden = !p.radius;
  $("wgCard").hidden = p.wg === "none" && !["cambium"].includes(p.id) ? true : false;
  $("keyWrap").hidden = !p.key;
  $("radCount").disabled = $("region").value === "apac";
  $("gRegWrap").hidden = !$("v_google").checked;
  /* The platform writes its /sp/ value into the URL box, except while the user is typing in it. */
  if (urlUsed && document.activeElement !== box) { const c = canonicalUrl(box.value, p); if (c !== box.value) box.value = c; }

  const loc = clean($("loc").value);
  const x = { p, loc, sfx: $("suffix").checked && loc ? "_" + loc : "", ssid: $("ssid").value.trim() || "Guest", vlan: $("vlan").value.trim(),
    life: parseInt($("life").value, 10) || 720, key: $("ckey").value.trim(), f: fv,
    secret: $("secret").value || "<RADIUS_SECRET>",
    servers: RADIUS[$("region").value].slice(0, $("region").value === "apac" ? 1 : parseInt($("radCount").value, 10)) };
  if (p.id === "cambium" || p.wg !== "none") {
    const coreP = p.id === "cambium" ? Object.assign({}, p, { core: ["*.cloudi-fi.net", "*.cloudi-fi.com"], wg: "wild" }) : p;
    x.wg = walledGarden(coreP);
    $("coreN").textContent = (coreP.core || []).length;
    $("wgCount").textContent = x.wg.count + " entries";
    const msgs = [];
    VENDORS.filter(v => v.needs && $("v_" + v.id).checked && !v.needs.some(n => $("v_" + n).checked)).forEach(v => msgs.push(v.name + " links to an existing Facebook or Google account; turn one of those on too."));
    if (p.id.startsWith("c9800") && x.wg.count > 100) msgs.push(x.wg.count + " entries; a 9800 URL filter list may cap at 100.");
    $("wgStatus").hidden = !msgs.length; $("wgStatus").className = "status warn"; $("wgStatus").textContent = msgs.join(" ");
  } else x.wg = { groups: [], all: [], count: 0 };

  let urlInfo = { notes: [] };
  if (urlUsed) {
    const r = parseUrl($("url").value, p);
    const st = $("urlStatus");
    if (r.err) {
      st.hidden = false; st.className = "status bad"; st.textContent = r.err;
      syncTokens("", "");
      $("out").innerHTML = '<div class="note"><b>Waiting for a splash page URL</b><ul><li>Copy it from the location\'s menu in the Cloudi-Fi console, or type the company and location hashes.</li></ul></div>';
      saveState(); return;
    }
    /* While typing, say what will happen to an /sp/ value that matches no platform. */
    const warns = r.msgs.map(m => m[1]), spNow = spOf(box.value);
    if (p.sp && spNow !== p.sp) warns.push(spNow ? "/sp/" + spNow + " matches no platform; it becomes /sp/" + p.sp + "." : "/sp/" + p.sp + " is added for this platform.");
    const info = [urlNote, r.note].filter(Boolean).join(" ");
    st.hidden = !warns.length && !info; st.className = "status " + (warns.length ? "warn" : "ok"); st.textContent = warns.length ? warns.join(" ") : info;
    syncTokens(r.ch, r.lh);
    Object.assign(x, { url: r.url, host: r.host, path: r.path || "", ch: r.ch, lh: r.lh });
  }
  if (p.radius && !$("secret").value) urlInfo.notes.push("No RADIUS secret entered; output uses a <RADIUS_SECRET> placeholder.");
  Object.assign(x, { tMac: $("tMac").value.trim() || "a4:83:e7:12:34:56", tIp: $("tIp").value.trim() || "10.20.0.50", tUser: $("tUser").value.trim() || "cftest", tPass: $("tPass").value || "cftest" });
  try { const res = p.gen(x); res.ts = troubleshoot(x); render(p, res, urlInfo); }
  catch (err) { $("out").innerHTML = '<div class="note"><b>Generator error</b><ul><li>' + esc(err.message) + "</li></ul></div>"; }
  saveState();
}
/* Shows the hashes parsed from the URL, without touching the box the user is typing in. */
function syncTokens(ch, lh) {
  [["ch", ch], ["lh", lh]].forEach(([id, v]) => { const el = $(id); if (el !== document.activeElement && el.value !== v) el.value = v; });
}

/* The other direction: typing or pasting a URL whose /sp/ belongs to another platform switches to it.
   WiNG uses the console URL unchanged, so its /sp/ is not a platform choice.
   Picking a platform by hand replaces the "Platform set" message. Both are registered before build so they run first. */
$("url").addEventListener("input", () => {
  const sp = spOf($("url").value), cur = P.find(q => q.id === $("platform").value) || P[0];
  const match = cur.url !== "asis" && sp && sp !== cur.sp && P.find(q => q.sp === sp);
  if (match) { $("platform").value = match.id; urlNote = "Platform set to " + match.vendor + " · " + match.name + " from /sp/" + sp + "."; }
});
["input", "change"].forEach(t => $("platform").addEventListener(t, () => { urlNote = ""; }));
STATIC.forEach(id => { const el = $(id); el.addEventListener("input", build); el.addEventListener("change", build); });
$("showSecret").addEventListener("change", e => { $("secret").type = e.target.checked ? "text" : "password"; });
["ch", "lh"].forEach(id => $(id).addEventListener("input", () => {
  $("url").value = setTokens($("url").value, { ch: $("ch").value, lh: $("lh").value });
  build();
}));
$("copyLink").addEventListener("click", () => {
  const link = shareLink(), q = new URLSearchParams(link.split("#")[1]);
  const msg = SECRET_KEYS.some(k => q.get(k)) ? "Link copied. It contains secrets: share it privately." : "Link copied";
  try { navigator.clipboard.writeText(link).then(() => toast(msg), () => toast("Copy blocked; copy the address bar instead")); } catch (err) { toast("Copy blocked; copy the address bar instead"); }
});
/* A link pasted into the address bar of an open tab only changes the fragment: reload the form from it. */
window.addEventListener("hashchange", () => { if (location.hash.slice(1) !== stateParams().toString()) { loadState(); build(); } });
/* Touch screens: a tap focuses the tooltip so it opens. */
document.addEventListener("click", e => { const t = e.target.closest(".tip"); if (t) t.focus(); });
/* ---------- KB refresh button ---------- */
(function () {
  const btn = $("kbRefresh"), st = $("kbStatus");
  const uniq = new Set(KB_INDEX.articles.map(a => a.id)).size;
  $("kbChecked").textContent = P.length + " platforms from " + uniq + " articles · checked " + new Date(KB_INDEX.checked + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const say = (t, cls) => { st.textContent = t; st.className = "src " + (cls || ""); };
  /* The refresh only works inside claude.ai (it starts a scheduled Claude task); elsewhere, e.g. GitHub Pages, hide it. */
  if (!(window.claude && window.claude.use)) { btn.hidden = true; return; }
  let mcp = null;
  btn.disabled = true;
  say("Connecting…");
  (window.claude && window.claude.use ? window.claude.use("mcp") : Promise.resolve(null)).then(m => {
    mcp = m;
    if (!m) { say("Refresh works when this page is opened in claude.ai.", ""); return; }
    btn.disabled = false; say("");
  }).catch(() => say("Refresh works when this page is opened in claude.ai."));
  btn.addEventListener("click", async () => {
    if (!mcp) return;
    btn.disabled = true; say("Starting the refresh…");
    try {
      await mcp.callTool("Claude Code Remote", "fire_trigger", { trigger_id: REFRESH_TASK, text: "Manual refresh requested from the builder page on " + new Date().toISOString().slice(0, 10) + "." });
      say("Refresh started. It runs in the cloud for a few minutes, then this page reloads itself with any new articles. You'll get a notification with what changed.", "ok");
    } catch (e) {
      const c = e && e.code;
      const msg = {
        server_not_connected: "Add the Claude Code Remote connector in claude.ai Settings › Connectors, then try again.",
        needs_reauth: "Reconnect Claude Code Remote in claude.ai Settings › Connectors, then try again.",
        not_in_manifest: "This page isn't allowed to start the refresh. Allow Claude Code Remote in the artifact's Permissions menu.",
        approval_required: "Starting the refresh needs your approval. Click again and choose Allow.",
        blocked_by_policy: "Your organization's policy blocks starting scheduled tasks from a page.",
        tool_error: "The refresh task refused to start: " + ((e && e.message) || "unknown reason") + ". It may have been deleted or paused.",
        server_unavailable: "Couldn't reach the scheduler. The refresh may or may not have started; wait a minute before clicking again."
      }[c] || "Couldn't start the refresh (" + (c || "error") + "). Ask Claude to run the Cloudi-Fi builder KB refresh instead.";
      say(msg, "bad");
      btn.disabled = false;
    }
  });
})();

window.__cf = { P, build, fv, fstate, KB_INDEX };
loadState();
build();

"use strict";
/* Generators: one function per platform. Each receives the computed inputs (x) and returns { blocks, notes }. */

/* ---------- block helpers ---------- */
const cli = (title, lines, lang) => ({ kind: "cli", title, lines, lang: lang || "ios" });
const sheet = (title, path, rows) => ({ kind: "sheet", title, path, rows });
const verifyRe = /VERIFY/;

/* =================== Generators =================== */
function g9800(x) {
  const mode = x.p.id, flex = mode !== "c9800-local", flexLocal = mode === "c9800-flexls";
  const sfx = x.sfx;
  const N = { pmap: "Cloudi-Fi" + sfx, wlan: "Cloudi-Fi_Guest" + sfx, pol: (flex ? "Cloudi-Fi_Guest_flex" : "guest_policy") + sfx,
    tag: (flex ? "flex_guest_tag" : "guest_tag") + sfx, site: "flex_site_tag" + sfx, flexp: "Flex_Profile" + sfx,
    grp: "Cloudi-Fi-Group", auth: "Cloudi-Fi_Auth", acct: "Cloudi-Fi_Acct", acl: flex ? "Cloudi-Fi_ACL_Flex" : "Cloudi-Fi_ACL", wg: flex ? "Walled_Garden" : "WalledGarden" };
  const com = x.f("c9_comments"), skip = x.f("c9_skip"), useAcl = flex || x.f("c9_acl");
  const wlanId = Math.max(1, Math.min(4096, parseInt(x.f("c9_wlanId"), 10) || 1));
  const L = [];
  const c = t => { if (com) L.push("! " + t); };
  const v = t => { if (com) L.push("! VERIFY: " + t); };
  c("Cloudi-Fi captive portal, Catalyst 9800 " + x.p.name.split("· ")[1] + (x.loc ? ", location " + x.loc : ""));
  L.push("configure terminal", "!");
  if (!skip) {
    c("--- AAA ---");
    L.push("aaa new-model");
    x.servers.forEach((ip, i) => L.push("radius server Cloudi-Fi-Rad" + (i + 1), " address ipv4 " + ip + " auth-port 1812 acct-port 1813", " timeout 10", " retransmit 3", " key " + x.secret, "exit"));
    L.push("aaa group server radius " + N.grp);
    x.servers.forEach((ip, i) => L.push(" server name Cloudi-Fi-Rad" + (i + 1)));
    L.push(" mac-delimiter hyphen", "exit", "aaa authentication login " + N.auth + " group " + N.grp, "aaa accounting identity " + N.acct + " start-stop group " + N.grp, "!");
    c("--- AAA Advanced: attribute formatting ---");
    ["authentication", "accounting"].forEach(k => L.push("radius-server attribute wireless " + k + " call-station-id ap-macaddress-ssid", "radius-server attribute wireless " + k + " mac-delimiter hyphen"));
    v("case keywords are camelCase on most 17.x builds");
    ["authentication", "accounting"].forEach(k => L.push("radius-server attribute wireless " + k + " callStationIdCase upper", "radius-server attribute wireless " + k + " usernameCase lower"));
    L.push("!");
  }
  c("--- Web auth ---");
  L.push("parameter-map type webauth global", " virtual-ip ipv4 " + (x.f("c9_vip") || "192.0.2.2"), "exit");
  L.push("parameter-map type webauth " + N.pmap, " type webauth", " max-http-conns 200", " timeout init-state sec 3600",
    " redirect for-login " + x.url, " redirect on-success " + SUCCESS, " redirect on-failure " + x.url,
    " redirect append ap-mac tag ap_mac", " redirect append client-mac tag client_mac", " redirect append wlan-ssid tag wlan_ssid",
    " redirect portal ipv4 104.26.5.244", " logout-window-disabled");
  v("GUI 'Disable Success Window'");
  L.push(" success-window-disable");
  v("GUI 'Sleeping Client Timeout'");
  L.push(" sleeping-client timeout 720", "exit", "!");
  if (useAcl) {
    c("--- Pre-auth ACL ---");
    L.push("ip access-list extended " + N.acl);
    let seq = 10; const add = r => { L.push(" " + seq + " " + r); seq += 10; };
    if (flex) {
      ["172.67.70.208", "172.67.70.238", "104.26.4.244", "104.26.5.244", CF_IP].forEach(ip => { add("permit ip any host " + ip); add("permit ip host " + ip + " any"); });
      add("permit udp any eq bootps any"); add("permit udp any any eq bootpc"); add("permit udp any eq domain any"); add("permit udp any any eq domain");
    } else {
      const dns = String(x.f("c9_dns")).split(/[\s,]+/).filter(d => /^\d{1,3}(\.\d{1,3}){3}$/.test(d));
      dns.forEach(ip => { add("permit udp any host " + ip + " eq domain"); add("permit udp host " + ip + " eq domain any"); });
      add("permit ip any host " + CF_IP); add("permit ip host " + CF_IP + " any");
      add("permit udp any any eq bootpc"); add("permit udp any any eq bootps"); add("deny ip any any");
    }
    L.push("exit", "!");
  }
  c("--- Walled garden ---");
  L.push("urlfilter list " + N.wg, " action permit", " filter-type pre-authentication");
  x.wg.groups.forEach(g => { c(g[0]); g[1].forEach(d => L.push(" url " + d)); });
  L.push("exit", "!");
  if (flex) {
    c("--- Flex profile ---");
    L.push("wireless profile flex " + N.flexp, " native-vlan-id " + (x.f("c9_native") || "1"), " acl-policy " + N.acl);
    v("URL filter under the flex ACL policy");
    L.push("  urlfilter list " + N.wg, " exit");
    if (flexLocal) L.push(" vlan-name " + (x.vlan || "guest"), "  vlan-id " + (x.f("c9_vlanid") || "20"), " exit");
    L.push("exit", "wireless tag site " + N.site, " flex-profile " + N.flexp, " no local-site", "exit", "!");
  }
  c("--- WLAN ---");
  L.push("wlan " + N.wlan + " " + wlanId + " " + x.ssid, " shutdown", " no security ft adaptive", " no security wpa", " no security wpa wpa2",
    " no security wpa wpa2 ciphers aes", " no security wpa akm dot1x", " security web-auth",
    " security web-auth authentication-list " + N.auth, " security web-auth parameter-map " + N.pmap);
  if (useAcl) L.push(" ip access-group web " + N.acl);
  L.push(" no shutdown", "exit", "!");
  c("--- Policy profile ---");
  L.push("wireless profile policy " + N.pol, " shutdown", " aaa-override", " accounting-list " + N.acct, " idle-timeout 3600", " session-timeout 43200", " urlfilter list pre-auth-filter " + N.wg);
  if (flexLocal) { c("FlexConnect local switching"); L.push(" no central-switching"); }
  if (x.vlan) L.push(" vlan " + x.vlan);
  L.push(" no shutdown", "exit", "!");
  c("--- Policy tag ---");
  L.push("wireless tag policy " + N.tag, " wlan " + N.wlan + " policy " + N.pol, "exit", "!");
  const aps = String(x.f("c9_aps") || "").split(/\n/).map(s => s.trim()).filter(Boolean);
  const bad = [];
  if (aps.length) {
    c("--- Tag APs (each AP rejoins" + (flex ? " and reboots for the site tag" : "") + ") ---");
    aps.forEach(a => { const h = a.toLowerCase().replace(/[^0-9a-f]/g, ""); if (h.length !== 12) { bad.push(a); return; }
      L.push("ap " + h.slice(0, 4) + "." + h.slice(4, 8) + "." + h.slice(8), " policy-tag " + N.tag); if (flex) L.push(" site-tag " + N.site); L.push("exit"); });
    L.push("!");
  }
  c("--- HTTP/HTTPS for web auth intercept ---");
  L.push("ip http server", "ip http secure-server", "end");
  if (x.f("c9_wr")) L.push("write memory");
  const notes = [
    "Lines tagged VERIFY are GUI-to-CLI mappings that vary by IOS-XE train. Run ? at that prompt once on your release.",
    "Editing an existing WLAN or policy profile drops its clients. Each one is shut, changed and brought back up.",
    "The Local Mode KB names the WLAN's parameter map guest_wifi, which doesn't match the map it creates; this uses your map name in both places."
  ];
  if (x.wg.count > 100) notes.unshift("Walled garden has " + x.wg.count + " entries; a 9800 URL filter list may cap at 100. Drop a vendor or split the list.");
  if (flex) notes.push("The KB edits default-site-tag, which touches every AP. This creates " + N.site + " instead; only the APs you tag move to it.",
    "The Flex KB ACL lists 172.67.70.208; other Cloudi-Fi articles use 172.67.70.238. Both are permitted.");
  if (bad.length) notes.unshift("Skipped AP MACs that aren't 12 hex digits: " + bad.join(", "));
  const ver = ["show parameter-map type webauth name " + N.pmap, "show wlan name " + N.wlan, "show wireless profile policy detailed " + N.pol,
    "show wireless tag policy detailed " + N.tag, flex ? "show wireless profile flex detailed " + N.flexp : "show urlfilter list " + N.wg,
    "show aaa servers brief", "test aaa group " + N.grp + " testuser testpass new-code", "show wireless client summary"];
  return { blocks: [cli("Configuration", L), cli("Verify", ver)], notes };
}

function gAireos(x) {
  const id = parseInt(x.f("ai_wlanId"), 10) || 5, acl = "cloudifi_pre-auth", L = [];
  x.servers.forEach((ip, i) => {
    L.push("config radius auth add " + (i + 1) + " " + ip + " 1812 ascii " + x.secret, "config radius auth management " + (i + 1) + " disable",
      "config radius acct add " + (i + 1) + " " + ip + " 1813 ascii " + x.secret);
  });
  L.push("config radius callStationIdType ap-macaddr-ssid");
  L.push("config acl create " + acl);
  let n = 1;
  const rule = (proto, src, dst, sp, dp) => {
    L.push("config acl rule add " + acl + " " + n, "config acl rule action " + acl + " " + n + " permit");
    if (proto) L.push("config acl rule protocol " + acl + " " + n + " " + proto);
    if (src) L.push("config acl rule source address " + acl + " " + n + " " + src + " 255.255.255.255");
    if (dst) L.push("config acl rule destination address " + acl + " " + n + " " + dst + " 255.255.255.255");
    if (sp) L.push("config acl rule source port range " + acl + " " + n + " " + sp[0] + " " + sp[1]);
    if (dp) L.push("config acl rule destination port range " + acl + " " + n + " " + dp[0] + " " + dp[1]);
    n++;
  };
  const dns = x.f("ai_dns") || "8.8.8.8";
  rule(17, null, dns, null, [53, 53]); rule(17, dns, null, [53, 53], null);
  [CF_IP, "104.26.5.244", "172.67.70.238", "104.26.4.244", "188.165.39.61"].forEach(ip => { rule(null, null, ip); rule(null, ip, null); });
  x.servers.forEach(ip => rule(17, null, ip, null, [1812, 1813]));
  L.push("config acl rule add " + acl + " " + n, "config acl rule action " + acl + " " + n + " deny", "config acl apply " + acl);
  L.push("config acl create cloudifi_authenticated", "config acl rule add cloudifi_authenticated 1", "config acl rule action cloudifi_authenticated 1 permit", "config acl apply cloudifi_authenticated");
  L.push("config wlan create " + id + " Cloudi-Fi_Guest" + x.sfx + " " + x.ssid, "config wlan disable " + id,
    "config wlan interface " + id + " " + (x.f("ai_intf") || "guest"), "config wlan broadcast-ssid enable " + id);
  if (x.key) L.push("config wlan nasid " + x.key + " " + id);
  L.push("config wlan security wpa disable " + id, "config wlan security web-auth enable " + id, "config wlan security web-auth acl " + id + " " + acl,
    "config wlan security web-auth server-precedence " + id + " radius",
    "config wlan custom-web global disable " + id, "config wlan custom-web webauth-type external " + id, "config wlan custom-web ext-webauth-url " + x.url + " " + id,
    "config wlan custom-web sleep-client enable " + id + " 720",
    "config network web-auth captive-bypass disable");
  x.servers.forEach((ip, i) => L.push("config wlan radius_server auth add " + id + " " + (i + 1), "config wlan radius_server acct add " + id + " " + (i + 1)));
  L.push("config wlan radius_server overwrite-interface enable " + id,
    "config wlan aaa-override enable " + id, "config wlan session-timeout " + id + " " + (x.f("ai_sess") || "720"),
    "config wlan usertimeout 720 " + id, "config wlan exclusionlist " + id + " 180");
  if (x.f("ai_flex")) L.push("config wlan flexconnect local-switching " + id + " enable", "config wlan flexconnect learn-ipaddr " + id + " enable");
  L.push("config wlan enable " + id, "save config");
  return { blocks: [cli("Configuration", L, "plain"), cli("Verify", ["show wlan " + id, "show acl detailed " + acl, "show radius summary", "test aaa radius username testuser password testpass wlan-id " + id], "plain")],
    notes: [
      "AireOS doesn't accept comments, so this block has none. Paste it at the (Cisco Controller) > prompt.",
      "Translated from the KB's GUI steps. Check server-precedence, sleep-client and overwrite-interface with ? on your release; they moved between 8.x builds.",
      "The KB's session timeout is 720 seconds, which forces guests back to the portal every 12 minutes. Set it to the portal lifetime in seconds unless you mean that.",
      "Captive Network Assistant bypass is a global setting on AireOS (config network web-auth captive-bypass).",
      x.key ? "NAS-ID is set to your company key." : "Add your Cloudi-Fi company key above to set the WLAN NAS-ID, which the KB requires."
    ] };
}

function gME(x) {
  return { blocks: [
    sheet("RADIUS global", "Management › Admin › RADIUS (Expert View)", [["Auth Call Station ID Type", "AP MAC Address:SSID"], ["Auth MAC Delimiter", "Hyphen"], ["Acct Call Station ID Type", "AP MAC Address:SSID"], ["Acct MAC Delimiter", "Hyphen"]]),
    sheet("RADIUS authentication servers", "Management › Admin › RADIUS › Add", x.servers.flatMap((ip, i) => [["Server " + (i + 1) + " IP", ip], ["Shared secret", x.secret, "secret"], ["Port", "1812"], ["State / CoA", "Enabled / Disabled"]])),
    sheet("Pre-auth ACL", "Wireless Settings › Access Control Lists", aclRows(x)),
    sheet("WLAN", "Wireless Settings › WLANs › Add new", [["Profile name", "Guest Wi-Fi"], ["SSID", x.ssid], ["Admin state / Radio policy / Broadcast", "Enabled / ALL / Enabled"],
      ["Guest network", "Enabled"], ["Captive Network Assistant", "Enabled"], ["RADIUS compatibility", "Cisco ACS"], ["Captive portal", "External splash page"],
      ["Captive portal URL", x.url], ["Access type", "RADIUS"], ["ACL name (IPv4)", "Cloudi-Fi pre-auth ACL"], ["RADIUS server", "the servers above"], ["Allow AAA override", "Enabled"]])
  ], notes: ["The KB shows the ACL rules only as a screenshot; the rules above reuse the AireOS article's list."] };
}
function aclRows(x) {
  return [["DNS", "permit UDP 53 to/from your DNS server"]].concat([CF_IP, "104.26.5.244", "172.67.70.238", "104.26.4.244", "188.165.39.61"].map(ip => ["Cloudi-Fi", "permit any to/from " + ip]))
    .concat(x.servers.map(ip => ["RADIUS", "permit UDP 1812-1813 to " + ip])).concat([["Last rule", "deny any"]]);
}

function wgRows(x) { return x.wg.groups.map(g => [g[0], g[1].join("\n")]); }
function radRows(x, extra) {
  const rows = [];
  x.servers.forEach((ip, i) => rows.push([["Primary", "Secondary", "Tertiary", "Quaternary"][i] + " server", ip]));
  rows.push(["Shared secret", x.secret, "secret"], ["Auth / Acct ports", "1812 / 1813"]);
  return rows.concat(extra || []);
}

function gMerakiApi(x) {
  const mx = x.f("mk_dev") === "mx";
  return { blocks: [
    sheet("Meraki API key", "Organization › API & Webhooks", [["Generate API key", "Copy it once; each admin can hold two keys"]]),
    sheet("Cloudi-Fi integration", "Cloudi-Fi › Configuration › Integrations › Meraki", [["Sync mode", "Automatic"], ["Meraki cloud", "World (or China)"], ["API key", "paste the Meraki key, then Connect"],
      ["Create locations", "From networks or From AP tags"], ["Import", mx ? "Only MX" : "Only MR"], ["SSID mode", "Automatic (Cloudi-Fi pushes the SSID) or Manual"]]),
    sheet("SSID (only if SSID mode is Manual)", mx ? "Security & SD-WAN › Wireless settings, then Access control per VLAN" : "Wireless › SSIDs › Access control", [
      ["Security", "Open"].concat([]), ["Splash page", "Click-through"], ["Captive portal strength", "Block all access until sign-on is complete"],
      ["Walled garden", "Enabled"], ["Walled garden ranges", x.wg.all.join("\n")], ["Controller disconnection", "Restricted"],
      ["Splash page type", "Custom splash URL (copy it from the Cloudi-Fi Meraki integration › Configure SSID)"],
      [mx ? "Network access control" : "Client IP and VLAN", mx ? "Disabled" : "NAT mode"]]),
    sheet("Syslog (compliance)", "Network-wide › General › Reporting", [["Server", "Cloudi-Fi syslog (logs.cloudi-fi.net)"], ["Port", "514"], ["Roles", "URLs, Flows"]])
  ], notes: ["The custom splash URL comes from the Meraki integration screen in Cloudi-Fi, not the location's splash page URL, so the pasted URL isn't used here."] };
}
function gMerakiRad(x) {
  return { blocks: [
    sheet("SSID", "Wireless › SSIDs › Access control", [["Security", "MAC-based access control (no encryption)"], ["RADIUS servers", x.servers.join("\n")], ["RADIUS secret", x.secret, "secret"], ["Ports", "1812 auth, 1813 accounting"],
      ["Splash page", "Click-through"], ["Client IP and VLAN", "Meraki AP assigned (NAT) or external DHCP"]]),
    sheet("Splash page", "Wireless › Splash page", [["Custom splash URL", "copy it from Cloudi-Fi › Settings › Integrations › Meraki › Configure SSID"]])
  ], notes: ["Use the RADIUS Test link on the SSID with a test user once saved."] };
}
function gMerakiTun(x) {
  return { blocks: [sheet("Non-Meraki VPN peer", "Security & SD-WAN › Site-to-site VPN", [["Name", "Cloudi-Fi-Zscaler" + x.sfx], ["Public IP", x.f("tn_gw") || "(Zscaler gateway)"], ["Local ID / User FQDN", x.f("tn_id") || "(Cloudi-Fi VPN key)"],
    ["Pre-shared key", x.f("tn_psk") || "(Cloudi-Fi VPN secret)", "secret"], ["IPsec policy", "Custom: match Zscaler supported parameters"], ["Remote subnets", "0.0.0.0/0 (send guest default route)"], ["Availability", "All networks or the tagged guest networks"]])],
    notes: ["VPN key and secret are under Cloudi-Fi › Locations › Edit Location. A dynamic WAN IP needs Meraki support to enable the User FQDN field."] };
}

function gForti(x) {
  const vap = x.f("fg_mode") !== "intf", obj = x.f("fg_obj") || "cf-guest", wan = x.f("fg_wan") || "wan1", L = [];
  const grp = "Cloudi-Fi_Radius_group", srv = "Cloudi-Fi_Radius_Srv", wgName = "Cloudi-Fi_WalledGarden", ex = "Cloudi-Fi_exempt";
  L.push("# --- RADIUS server and group ---", "config user radius", '    edit "' + srv + '"', '        set server "' + x.servers[0] + '"', '        set secret ' + x.secret);
  if (x.servers[1]) L.push('        set secondary-server "' + x.servers[1] + '"', "        set secondary-secret " + x.secret);
  if (x.servers[2]) L.push('        set tertiary-server "' + x.servers[2] + '"', "        set tertiary-secret " + x.secret);
  L.push("    next", "end", "config user group", '    edit "' + grp + '"', "        set group-type firewall", '        set member "' + srv + '"', "    next", "end");
  L.push("# --- Walled garden address objects ---", "config firewall address");
  const names = x.wg.all.map(d => "CF-" + d.replace(/^\*\./, "wild.").slice(0, 70));
  x.wg.all.forEach((d, i) => L.push('    edit "' + names[i] + '"', "        set type fqdn", '        set fqdn "' + d + '"', "    next"));
  L.push("end", "config firewall addrgrp", '    edit "' + wgName + '"', "        set member " + names.map(n => '"' + n + '"').join(" "), "    next", "end");
  L.push("# VERIFY: exempt list syntax (GUI 'Exempt destinations/services')", "config user security-exempt-list", '    edit "' + ex + '"', "        config rule",
    "            edit 1", '                set dstaddr "' + wgName + '"', '                set service "ALL"', "            next",
    "            edit 2", '                set dstaddr "all"', '                set service "DNS"', "            next", "        end", "    next", "end");
  if (vap) {
    L.push("# --- Captive portal SSID ---", "config wireless-controller vap", '    edit "' + obj.slice(0, 15) + '"', '        set ssid "' + x.ssid + '"', "        set security captive-portal",
      "        set portal-type auth", '        set external-web "' + x.url + '"', '        set selected-usergroups "' + grp + '"',
      '        set security-exempt-list "' + ex + '"', '        set security-redirect-url "' + SUCCESS + '"', "    next", "end");
  } else {
    L.push("# --- Captive portal on the guest interface ---", "config system interface", '    edit "' + obj + '"', "        set security-mode captive-portal",
      '        set security-external-web "' + x.url + '"', '        set security-groups "' + grp + '"', '        set security-exempt-list "' + ex + '"',
      '        set security-redirect-url "' + SUCCESS + '"', "    next", "end");
  }
  L.push("# --- Auth protocols (portal detection needs HTTP) ---", "config user setting", "    set auth-timeout 5", "    set auth-type http https");
  if (x.f("fg_https")) L.push("    set auth-secure-http enable", '    set auth-cert "' + (x.f("fg_cert") || "guest-cert") + '"');
  L.push("end");
  if (x.f("fg_https")) {
    if (x.f("fg_v706")) L.push("config system interface", '    edit "' + obj.slice(0, 15) + '"', '        set auth-portal-addr "' + x.f("fg_fqdn") + '"', "    next", "end");
    else L.push("config firewall auth-portal", '    set portal-addr "' + x.f("fg_fqdn") + '"', "end");
  }
  const src = obj.slice(0, vap ? 15 : 99);
  const pol = (name, dst, svc, act, exempt) => {
    L.push("    edit 0", '        set name "' + name + '"', '        set srcintf "' + src + '"', '        set dstintf "' + wan + '"', '        set srcaddr "all"',
      '        set dstaddr ' + dst, "        set action " + act, '        set schedule "always"', "        set service " + svc);
    if (act === "accept") L.push("        set nat enable");
    if (exempt) L.push("        set captive-portal-exempt enable");
    L.push("    next");
  };
  L.push("# --- Firewall policies, in this order ---", "config firewall address", '    edit "RFC1918-10"', "        set subnet 10.0.0.0 255.0.0.0", "    next", '    edit "RFC1918-172"', "        set subnet 172.16.0.0 255.240.0.0", "    next", '    edit "RFC1918-192"', "        set subnet 192.168.0.0 255.255.0.0", "    next", "end", "config firewall policy");
  pol("CF-DNS", '"all"', '"DNS"', "accept", true);
  pol("CF-Walled-Garden", '"' + wgName + '"', '"HTTP" "HTTPS"', "accept", true);
  if (x.f("fg_deny")) {
    L.push("    edit 0", '        set name "CF-Guest-Deny-Private"', '        set srcintf "' + src + '"', '        set dstintf "any"', '        set srcaddr "all"', '        set dstaddr "RFC1918-10" "RFC1918-172" "RFC1918-192"', "        set action deny", '        set schedule "always"', '        set service "ALL"', "    next");
  }
  pol("CF-Allow-Guest", '"all"', '"HTTP" "HTTPS"', "accept", false);
  L.push("end");
  return { blocks: [cli("Configuration", L, "forti"), cli("Verify", ["diagnose test authserver radius " + srv + " pap testuser testpass", "diagnose firewall auth list", "show " + (vap ? "wireless-controller vap " + src : "system interface " + src)], "forti")],
    notes: [
      "New policies land at the bottom of the table. Move the four CF- rules above any existing guest rules (the private-range deny sits ahead of Allow-Guest here so it actually matches).",
      vap ? "The SSID still needs its interface addressing and DHCP (Network section of the SSID). Set those in the GUI or under config system interface for the VAP." : "Use a dedicated guest interface; the portal applies to everything on it.",
      "Exempt-list and address syntax are FortiOS 6.4–7.6 style; wildcard FQDN objects need 6.2+. Check with ? if your build rejects a line.",
      "The KB GUI steps don't configure RADIUS accounting on FortiGate, so neither does this."
    ] };
}

function splitRows(x) { return [["Host", x.host], ["Page / URL", x.path]]; }
function gArubaMC(x) {
  return { blocks: [
    sheet("WLAN", "Configuration › WLANs › +", [["Name (SSID)", x.ssid], ["Primary usage", "Guest"], ["Forwarding mode", "Tunnel"], ["VLAN", x.vlan || "1"], ["Security", "ClearPass or other external captive portal"]]),
    sheet("Auth servers", "WLAN wizard › Security", radRows(x, [["Names", "Cloudi-Fi_Primary / Cloudi-Fi_Secondary"], ["Timeout", "5 s or more"]])),
    sheet("External portal", "WLAN wizard › Security", [["Host addressing", "IPv4"]].concat(splitRows(x), [["Redirect page", SUCCESS]])),
    sheet("Walled garden alias", "Roles & Policies › Aliases › +", [["Name", "Cloudi-Whitelist"]].concat(wgRows(x))),
    sheet("Captive portal profile", "Authentication › L3 › Captive Portal › ssid_ccpm_prof", [["Default role / guest role", "guest"], ["Default pause", "0"], ["User login / Guest login", "Enabled / Enabled"],
      ["Logout popup / Welcome page", "Disabled / Disabled"], ["Add switch IP, user VLAN, AP MAC to redirect URL", "Enabled"], ["Controller interface in redirect URL", x.f("ar_fqdn")], ["Whitelist", "Cloudi-Whitelist"]])
  ], notes: ["Import a public certificate and set it as the captive portal certificate (System › More › General).", "Test both servers with Diagnostics › Tools › AAA Server Test."] };
}
function gArubaIAP(x) {
  return { blocks: [
    sheet("Authentication server", "Security › Authentication Servers › New", radRows(x, [["Service type", "Framed User, Captive Portal"]])),
    sheet("External captive portal", "Security › External Captive Portal › New", [["Name", "Cloudi-Fi" + x.sfx], ["Type", "RADIUS Authentication"], ["IP or hostname", x.host], ["URL", x.path], ["Port", "443"], ["Use HTTPS", "Enabled"], ["Captive portal failure", "Deny Internet"], ["Everything else", "Disabled"]]),
    sheet("Pre-auth role", "Security › Roles › New", [["Name", "CloudiFi_pre-auth"], ["Rule", "Access control · Network · Allow"]].concat(wgRows(x))),
    sheet("WLAN", "Networks › +", [["Name", "CloudiFi-Guest"], ["SSID", x.ssid], ["Primary usage", "Guest"], ["Splash page type", "External"], ["Captive portal profile", "Cloudi-Fi" + x.sfx], ["WISPr / MAC auth", "Disabled / Disabled"],
      ["Auth server 1", "Cloudi-Fi RADIUS"], ["Reauth interval", x.life + " min"], ["Access", "Role-based, assign CloudiFi_pre-auth"]])
  ], verify: ["aaa test-server <server_name> username <user> password <pass> authtype pap"], notes: ["Upload a PEM/PKCS12 bundle (server, intermediate, root, key) under Maintenance › Certificates and reboot the AP to avoid certificate warnings."] };
}
function gArubaCentral(x) {
  return { blocks: [
    sheet("SSID", "Devices › Access Points › Config › Add SSID", [["Name", x.ssid], ["Security level", "Visitors"], ["Type", "External captive portal"]]),
    sheet("External captive portal profile", "SSID › Security", [["Type", "External Captive Portal"], ["IP or hostname", x.host], ["URL", x.path], ["Port", "443"], ["Use HTTPS", "Enabled (automatic URL allowlisting if offered)"], ["Redirect URL", SUCCESS]]),
    sheet("Auth servers", "SSID › Security", radRows(x, [["Retry / Timeout", "3 / 5"], ["Service type (Framed User)", "MAC, Captive Portal"], ["RFC 5997 status query", "Authentication and Accounting"]])),
    sheet("Pre-auth role", "SSID › Access › Assign pre-authentication role", [["Name", "Pre_auth_CFI"], ["Rule", "Access control · Network · Any · Allow · Log"]].concat(wgRows(x))),
    sheet("Post-auth role (optional)", "SSID › Access", [["Name", "Post_auth_Guest_CFI"], ["Assignment", "Aruba-User-Role equals cloudifi-guest"]])
  ], notes: ["Create one AP group per location under Global › Groups."] };
}
function gArubaAirwave(x) {
  return { blocks: [
    sheet("Group", "Groups › Basic", [["Instant GUI Config", "Enabled"]]),
    sheet("SSID", "Groups › Instant Config › Networks", [["Type / Usage", "Wireless / Guest"], ["Name", x.ssid], ["Splash page type", "External"]]),
    sheet("Captive portal profile", "Security › External Captive Portal", [["Type", "RADIUS Authentication"], ["IP or hostname", x.host], ["URL", x.path], ["Port", "443"], ["Use HTTPS", "Enabled"], ["Captive portal failure", "Deny Internet"], ["Automatic whitelisting", "Enabled"], ["Redirect URL", SUCCESS]]),
    sheet("Auth server", "Security › Authentication Servers", radRows(x, [["NAS-Identifier", x.key || "(your Cloudi-Fi public key)"], ["RFC 5997", "Authentication"], ["Service type", "Framed User, Captive Portal"]])),
    sheet("Pre-auth rule", "Access Rules › Role-based", [["Rule", "Access control · Network any · Allow · To a particular server · Log"]].concat(wgRows(x))),
    sheet("Syslog", "Instant Config › System Monitoring", [["Server", "logs.cloudi-fi.net"], ["Facilities", "User and User-Debug at Debug"]])
  ], notes: [] };
}
function gArubaIon(x) {
  return { blocks: [sheet("Guest network", "Networks › Add › Guest", [["Network name", x.ssid], ["Portal type", "External"], ["Server URL", x.url], ["Redirect URL", SUCCESS], ["Send RADIUS accounting", "Optional"]]
    .concat(x.servers.slice(0, 2).flatMap((ip, i) => [[(i ? "Secondary" : "Primary") + " RADIUS IP", ip], [(i ? "Secondary" : "Primary") + " secret", x.secret, "secret"]]))
    .concat([["Whitelisted domains", x.wg.all.join("\n")]]))], notes: ["Instant On takes two RADIUS servers at most."] };
}
function gRuckus(x) {
  const v5 = x.p.id === "ruckus-vsz5";
  return { blocks: [
    sheet("Hotspot (WISPr) portal", "Services › Hotspots & Portals › Hotspot (WISPr)", [["Portal name", "Cloudi-Fi Captive Portal" + x.sfx], ["Smart client support", "None"], ["Logon URL", "External"],
      ["Redirect unauthenticated user · Primary", x.url], ["Start page", "Redirect to " + SUCCESS], ["HTTPS redirect", "ON"], ["Session timeout / Grace period", x.life + " min / " + x.life + " min"]].concat(wgRows(x))),
    sheet("Authentication service", "Security › Authentication and Proxy", radRows(x, [["Name", "Cloudi-Fi Radius"], ["Protocol", "RADIUS"]])),
    sheet("WLAN", "Network › Wireless › Wireless LANs", [["Name / SSID", x.ssid], ["Authentication type", "Hotspot (WISPr)"], ["Method / Encryption", "Open / None"], ["Hotspot portal", "Cloudi-Fi Captive Portal" + x.sfx],
      ["Bypass CNA", "OFF"], ["Authentication service", "Proxy via controller › Cloudi-Fi Radius"], ["NAS ID", v5 ? (x.key || "(Custom: your Cloudi-Fi company key)") : "User-defined"], ["Called station ID", "AP MAC"], ["NAS IP", v5 ? "—" : "SZ control IP"]]),
    sheet("Northbound interface", v5 ? "System › General Settings › WISPr NBI" : "Administration › External Services › WISPr NBI", [["NBI support", "ON"], ["Username", x.f("rk_nbiu")], ["Password", "(set here, then enter both in Cloudi-Fi › Integrations › Ruckus SmartZone)"]]),
    cli("CLI (config mode)", ["config", "no encrypt-mac-ip", "end"], "plain")
  ], notes: ["Open TCP 8090, 8099, 8100, 8111, 9997, 9998 (WISPr) and 9080, 9443 (NBI) between SmartZone and Cloudi-Fi.", "The KB leaves 'Redirect unauthenticated user' blank in places; the transformed splash URL is the portal URL."].concat(v5 ? ["Swapping the hotspot certificate reboots the controller on 5.x. Do it after hours."] : []) };
}
function gRuckusOne(x) {
  return { blocks: [
    sheet("Wi-Fi network", "Network Control › Wi-Fi Networks › Add", [["Network type", "Captive Portal"], ["Portal type", "3rd Party Captive Portal (WISPr)"], ["Portal provider", "Cloudi-Fi"], ["Captive portal URL", x.url], ["Integration key", "generated here; paste into Cloudi-Fi as the NBI password"]].concat(wgRows(x))),
    sheet("Authentication service", "Network › Authentication › Add servers", radRows(x, [["Name", "Cloudi-Fi Radius"]])),
    sheet("Cloudi-Fi integration", "Cloudi-Fi › Settings › Integrations › Ruckus SmartZone", [["Local SmartZone controller", "Disabled"], ["NBI password", "the RUCKUS One integration key"]])
  ], notes: ["Cloudi-Fi accepts one integration key per tenant. Activate the network on the venues you want, then save."] };
}
function gMikrotik(x) {
  const mac = (x.f("mt_mac") || "AA:BB:CC:DD:EE:FF").toUpperCase(), prof = x.f("mt_prof") || "hsprof1", cert = x.f("mt_cert");
  const L = ["# Run after IP > Hotspot > Hotspot Setup has created the hotspot", "/radius"];
  x.servers.forEach(ip => L.push('add service=hotspot address=' + ip + ' secret="' + x.secret + '" authentication-port=1812 accounting-port=1813 src-address=0.0.0.0'));
  L.push("/ip hotspot walled-garden");
  x.wg.all.forEach(d => L.push("add dst-host=" + d + ' comment="Cloudi-Fi"'));
  L.push("/ip hotspot profile", "set [find name=" + prof + "] use-radius=yes radius-interim-update=10m radius-mac-format=XX:XX:XX:XX:XX:XX radius-location-id=" + mac + (cert ? " login-by=https ssl-certificate=" + cert : ""));
  L.push("/ip hotspot", "set [find profile=" + prof + "] name=" + mac + " addresses-per-mac=1");
  L.push("/ip hotspot user profile", "set [find name=default] keepalive-timeout=" + x.life + "m shared-users=unlimited");
  const sep = x.url.includes("?") ? "&" : "?";
  const login = ["<html>", "<head>", '<meta http-equiv="pragma" content="no-cache">', '<meta http-equiv="expires" content="-1">',
    '<meta http-equiv="refresh" content="0; url=' + x.url + sep + "spentityid=spmikrotik.com&res=notyet&host=$(server-name)&client_mac=$(mac-esc)&client_ip=$(ip)&userurl=$(link-orig-esc)&login_url=$(link-login-only-esc)&error=$(error)&user=$(username)\">",
    "</head>", "<body></body>", "</html>"];
  const alogin = ["<html>", "<head>", '<meta http-equiv="refresh" content="0; url=' + SUCCESS + '">', "</head>", "<body></body>", "</html>"];
  return { blocks: [cli("RouterOS script", L, "ros"), cli("hotspot/login.html", login, "html"), cli("hotspot/alogin.html", alogin, "html")],
    notes: ["Upload both HTML files to the hotspot folder under Files.", "The KB lists the login.html query names (res, host, client_mac, client_ip, userurl, login_url, error, user) but not every $(variable) they map to; the mapping here is the standard one. Compare with the file in Step 7 of the article.",
      "Set SNTP and the time zone, and point syslog to logs.cloudi-fi.net:514 for compliance logging."] };
}
function gExtremeCIQ(x) {
  const prof = x.f("ex_prof");
  const blocks = [
    sheet("Captive web portal", "Network policy › SSID › Captive Web Portal", [["Name", x.loc || "Cloudi-Fi location"], ["Authentication type", "Redirect to external URL"], ["Login URL", x.url], ["Password encryption", "Plaintext"], ["Auth method", "PAP"],
      ["Success page", "Off"], ["Redirect after login", SUCCESS], ["Use HTTP 302 / requested URL in clear text", "Checked / Checked"], ["Walled garden (service: Web)", x.wg.all.join("\n")], ["Registration period", x.life + " min"]]),
    sheet("RADIUS server", "Network policy › Authentication", radRows(x, [["Name", "Cloudi-Fi Radius Server"], ["Custom NAS-ID", x.key || "(your Cloudi-Fi company key)"]])),
    cli("Supplemental CLI · Cloudi-Fi Custom NAS-ID", ["aaa attribute NAS-Identifier " + (x.key || "YOUR_COMPANY_KEY")], "plain")
  ];
  if (prof) blocks.push(sheet("Stay authenticated after 30 min idle", "Wireless Networks › MAC Authentication / User Access", [["MAC authentication", "Enabled, PAP"], ["Assign user profiles by RADIUS attribute", "11 Filter-Id"], ["User profile", "cloudifi-" + prof + " with CWP bypass"], ["Assignment rule value", "cloudifi-" + prof]]));
  return { blocks, notes: ["Enable VIQ Management › Supplemental CLI first, then deploy with Complete Configuration Update."] };
}
function gWing(x) {
  return { blocks: [
    sheet("DNS whitelist", "Configuration › Services › DNS Whitelist", [["Name", "Cloudi-Fi-Whitelist"], ["Entries (Match Suffix ticked)", x.wg.all.join("\n")]]),
    sheet("Captive portal", "Configuration › Services › Captive Portals", [["Name", "CAP-Cloudi-Fi"], ["Server mode", "Internal (Self)"], ["Connection mode", "HTTP"], ["Access type", "No authentication required"], ["Terms and conditions page", "Ticked"],
      ["Client access time / Inactivity timeout", x.life + " min / " + x.life + " min"], ["DNS whitelist", "Cloudi-Fi-Whitelist"], ["Web page source", "External"], ["Agreement URL", x.url], ["Welcome URL", SUCCESS]]),
    sheet("WLAN", "Configuration › Wireless › WLANs › Security", [["SSID", x.ssid], ["Captive portal enforcement", "Enabled, CAP-Cloudi-Fi"]])
  ], notes: ["Commit and Save, or the config is lost on reboot."] };
}
function gMist(x) {
  return { blocks: [
    sheet("WLAN", "Site › WLANs › Add", [["SSID", x.ssid], ["Security", "Open"], ["Guest portal", "Forward to external portal"], ["Portal URL", "copy from Cloudi-Fi › Settings › Integrations › Juniper Mist › Configure"], ["Allowed hostnames", x.wg.all.join("\n")], ["API secret", "shown here; paste into Cloudi-Fi"]]),
    sheet("Cloudi-Fi integration", "Cloudi-Fi › Settings › Integrations › Juniper Mist", [["API secret key", "from the Mist guest portal section"]])
  ], notes: ["The portal URL comes from the Cloudi-Fi Mist integration, so the pasted splash URL isn't used here."] };
}
function huaweiTemplate(loginExtra) {
  return sheet("URL template", "Design › Site config › URL template", [["Name", "Cloudi-Fi-URL-Template"], ["redirect-url", "redirect-url"], ["loginurl", "login-url" + loginExtra], ["device-mac", "ap-mac"], ["user-ip", "uaddress"], ["user-mac", "umac"], ["ssid", "ssid"]]);
}
function gHuaweiPortal(x) {
  return { blocks: [
    huaweiTemplate(" https://{vlanif1}:8443"),
    sheet("Portal server", "Admission › Third-party portal servers", [["Name", "Cloudi-Fi-Portal"], ["Protocol / Method", "HTTPS / POST"], ["Redirect", "Static, " + SUCCESS], ["Password encoding", "None"], ["IP / Port", "172.67.70.238 / 443"], ["URL", x.url], ["Key", x.f("hw_key") || "(set one and share it with Cloudi-Fi support)", "secret"]]),
    sheet("ACL (default permit rule)", "Policy › ACL", [["Name / Type", "Cloudi-Fi-ACL / User"], ["DNS", "permit"]].concat(wgRows(x))),
    sheet("RADIUS relay", "Admission › RADIUS servers", radRows(x, [["Name / Type", "Cloudi-Fi-Radius / Third-party"]])),
    sheet("SSID", "Site › Wi-Fi › SSID", [["Name", x.ssid], ["VLAN", x.vlan], ["Security", "Open + Portal"], ["Auth type", "Third-party"], ["Portal / RADIUS", "Cloudi-Fi-Portal / Cloudi-Fi-Radius"], ["Default permit rule", "Cloudi-Fi-ACL"], ["Bypass", "Authenticated keep access, new users blocked"]])
  ], notes: ["Syslog to logs.cloudi-fi.net:514 at Info and enable NAT logs (1 s interval) on the AP site config."] };
}
function gHuaweiRadius(x) {
  return { blocks: [
    sheet("RADIUS relay", "Admission › RADIUS relay", radRows(x, [["Name", "Cloudi-Fi-Radius"], ["Service", "Portal authentication"], ["Protocol", "PAP"], ["NAS identifier", "Device MAC"], ["Timeout", "20 s"]])),
    sheet("ACL (default permit rule)", "Policy › ACL", [["Name / Type", "Cloudi-Fi-ACL / User"], ["DNS", "permit"]].concat(wgRows(x))),
    huaweiTemplate(""),
    sheet("SSID", "Site › Wi-Fi › SSID", [["Name", x.ssid], ["VLAN", x.vlan], ["Security", "Open + Portal"], ["Auth type", "Relay authentication by cloud platform"], ["Interconnection", "RADIUS relay"], ["Push protocol", "HTTPS"],
      ["Portal username / password", "username / password"], ["Redirect URL rule", "Redirect URL"], ["Redirect on success", SUCCESS], ["Default permit rule", "Cloudi-Fi-ACL"]]),
    sheet("Portal page push policy", "Admission › Push policy", [["Access mode", "Wireless"], ["Auth mode", "Cloud platform-based relay"], ["Interconnection", "RADIUS relay"], ["URL template", "Cloudi-Fi-URL-Template"], ["Third-party auth URL", x.url]])
  ], notes: ["Syslog to logs.cloudi-fi.net:514 at Info and enable NAT logs (1 s interval)."] };
}
function gHuaweiApi(x) {
  return { blocks: [
    sheet("API user", "System › Users", [["Type", "Third party"], ["Username", x.f("hw_apiu")], ["Password", "set it, then share with Cloudi-Fi support"], ["Roles", "Open API Operator, Open API Monitor"], ["Managed objects", "All resources"]]),
    sheet("Portal push policy", "Admission › Push policy", [["Name", "Cloudifi_Portal"], ["Access mode", "Wireless"], ["Auth mode", "Cloud platform-based relay"], ["Interconnection", "API"], ["Third-party auth URL", x.url]]),
    sheet("SSID", "Site › Wi-Fi › SSID", [["Name", x.ssid], ["Security", "Open + Portal"], ["Page push", "Cloud platform relay, API, HTTPS"], ["Bypass", "Authenticated keep access, new users denied"]])
  ], notes: [] };
}
function gAlcatel(x) {
  return { blocks: [
    sheet("RADIUS servers", "Security › Authentication servers", radRows(x, [["Names", "Cloudi-Fi_Primary / Cloudi-Fi_Secondary"], ["Retries / Timeout", "3 / 5"], ["VRF", "default"]])),
    sheet("Captive portal strategy", "Unified Access › Captive Portal › Strategy", [["Type", "External captive portal"], ["Portal server", x.f("al_cn") ? "login-cn.cloudi-fi.net" : x.host], ["Redirect URL", x.path], ["HTTPS redirection", "Enabled"], ["AAA server profile", "the RADIUS servers above"]].concat(wgRows(x))),
    sheet("SSID", "Unified Access › WLAN › SSID", [["Service name / SSID", x.ssid], ["Type", "Guest (captive portal: Yes)"], ["VLAN", x.vlan]])
  ], notes: [] };
}
function gCambium(x) {
  return { blocks: [
    sheet("Certificate and hostname", "Application › Server › SSL Certificates / Services › Guest Access", [["Certificate CN", x.f("cb_host")], ["Guest portal hostname", x.f("cb_host")], ["External portal post through cnMaestro", "Enabled"]]),
    sheet("WLAN AAA", "Shared Settings › WLANs › AAA", radRows(x)),
    sheet("Guest access", "WLAN › Guest Access", [["Portal", "External hotspot"], ["External URL", x.url], ["Success", SUCCESS]].concat(wgRows(x)))
  ], notes: ["The Cambium article doesn't list walled-garden entries; the Cloudi-Fi core set is shown for convenience. Add a DNS forward zone for the portal hostname."] };
}
function gCradle(x) {
  return { blocks: [
    sheet("Local network", "Networking › Local Networks", [["Name", "Cloudi-Guest" + x.sfx], ["IPv4 routing mode", "Hotspot"], ["DHCP", "Enabled"]]),
    sheet("SSID", "Networking › Wireless", [["SSID", x.ssid], ["Mode", "Controller and captive"], ["Security", "Open"]]),
    sheet("Hotspot services", "Networking › Hotspot Services", [["Mode", "RADIUS/UAM"], ["RADIUS server", x.servers[0]], ["Auth port", "1812"], ["Shared secret", x.secret, "secret"], ["Login URL", x.url], ["Redirect on success", "Admin URL: " + SUCCESS],
      ["UAM secret", x.f("cp_uam") || "(define one and send it to Cloudi-Fi support)", "secret"], ["Allowed hosts before auth", x.wg.all.join("\n")]]),
    sheet("Logging", "System › Logging", [["Level", "Debug"], ["Server", "logs.cloudi-fi.net:514"]])
  ], notes: ["Add a zone-firewall policy with an allow-and-log rule between the guest LAN and WAN for traffic logging."] };
}
function gEngenius(x) {
  return { blocks: [sheet("Captive portal", "Configure › Captive Portal › Add", [["Hotspot service", "Captive Portal"], ["Auth type 1", "RADIUS server"], ["RADIUS server", x.servers[0]], ["Secret", x.secret, "secret"], ["Auth type 2", "Splash & Go (checked)"], ["External splash page URL", x.url], ["Walled garden", x.wg.all.join("\n")]]),
    sheet("SSID", "Device Management › Device Config", [["SSID", x.ssid], ["Captive portal", "Enabled, select the profile above"]])], notes: ["The KB writes the EnGenius sp value as spenginius.com (sic); that's what's used."] };
}
function gPeplink(x) {
  return { blocks: [
    sheet("Guest LAN", "Network › Network Settings", [["Name", "Cloudi-Fi-Guest"], ["VLAN", x.vlan], ["DHCP", "Enabled"]]),
    sheet("RADIUS servers", "Advanced › Misc. Settings › RADIUS Server", radRows(x, [["Names", "Cloudi-Fi-Primary-Radius / Cloudi-Fi-Secondary-Radius"]])),
    sheet("Captive portal", "Network › Captive Portal", [["Name", "Cloudi-Fi-Captive-Portal"], ["Enable on", "Cloudi-Fi-Guest"], ["Hostname", x.f("pp_host")], ["Access mode", "User Authentication"], ["Accounting interim", "600 s"], ["NAS-Identifier", x.key || "(your Cloudi-Fi public key)"],
      ["Allowed networks", x.wg.all.join("\n")], ["Splash page", x.url]]),
    sheet("SSID", "AP › Wireless SSID", [["SSID", x.ssid], ["VLAN", x.vlan], ["Security", "Open"]])
  ], notes: ["Add a local DNS record for the portal hostname pointing at the guest LAN IP, and install the matching certificate."] };
}
function gZyxel(x) {
  return { blocks: [sheet("SSID advanced", "Configure › Access Point › SSID advanced settings", [["SSID", x.ssid], ["Security", "Open"], ["Sign-in method", "Click-to-continue"], ["Captive portal", "External"], ["Captive portal URL", x.url], ["Strict policy", "Block all access until sign-on"], ["Walled garden", "Enabled"], ["Walled garden ranges", x.wg.all.join("\n")]])],
    notes: ["The Zyxel article says to add the Cloudi-Fi domains without listing them; the core set is filled in."] };
}
function gPalo(x) {
  const prisma = x.p.id === "palo-prisma";
  return { blocks: [
    sheet("SAML IdP server profile (one per location)", "Device › Server Profiles › SAML Identity Provider", [["Name", "Cloudi-Fi" + x.sfx], ["Identity provider ID", SAML_IDP], ["SSO URL", x.url], ["Certificate", "import the Cloudi-Fi SAML certificate"]]),
    sheet("Authentication profile", "Device › Authentication Profile", [["Type", "SAML"], ["IdP server profile", "Cloudi-Fi" + x.sfx], ["Username attribute", "token"], ["User group attribute", "profile"]]),
    sheet("Captive portal", "Device › User Identification › Captive Portal Settings", [["Redirect host", x.f("pa_host")], ["Idle timer / Timer", x.life + " min / " + x.life + " min"], ["Cloudi-Fi integration value", x.f("pa_host") + ":6082"]]),
    sheet("Walled garden URL category", "Objects › Custom Objects › URL Category", [["Name / Type", "Cloudi-Fi_portal / URL List"], ["Sites", x.wg.all.join("\n")]]),
    sheet("Security rules, in order", "Policies › Security", [["Guest DNS proxy", "Guest gateway → DNS servers, app dns, allow"], ["Whitelist", "Guest zone, user unknown → external, web-browsing + ssl, URL category Cloudi-Fi_portal, allow"],
      ["Guest-Allowed", "Guest zone, user known-user → external, allow"], ["Guest-DenyAll", "Guest zone → any, deny"]]),
    sheet("Authentication rule (one per location)", "Policies › Authentication", [["Source", "Guest zone, user unknown"], ["Destination", "External zone"], ["Service", "HTTP/HTTPS"], ["Action", "Web form for Cloudi-Fi" + x.sfx]])
  ], notes: [prisma ? "Prisma Access provides the captive portal redirect IP; create the DNS record for the redirect host at your DNS provider and configure in the right Panorama template." : "Interface management profile needs Response Pages and User-ID; add a DNS proxy static entry mapping the redirect host to the guest interface IP."] };
}
function gVersa(x) {
  return { blocks: [
    sheet("SAML profile", "Objects & Connectors › Users/Group › SAML Profile", [["Host", "https://cloudi-fi.versa-networks.com:44991"], ["SSO URL", x.url], ["SP entity ID", "https://cloudi-fi.versa-networks.com:44991/metadata"], ["Identity provider ID", SAML_IDP], ["IdP certificate", "Cloudi-Fi SAML certificate"]]),
    sheet("Bypass", "Authentication rules", [["URL category", x.wg.all.join("\n")], ["Rules", "bypass DNS; bypass the SSO URL; SAML for all guest Wi-Fi traffic"]])
  ], notes: ["The Versa example drops /lh/ and keeps only /start/<ch>. If login fails, try the /start/<ch>/<lh> form the Palo Alto article uses.", "Requires VOS 20.2+, Prime Secure SD-WAN, NG-FW and DNS proxy."] };
}
function gPfsense(x) {
  return { blocks: [
    sheet("Guest VLAN interface", "Interfaces › Assignments", [["VLAN ID", x.vlan || "10"], ["Name", "VPN Guest"], ["IPv4", x.f("pf_net")], ["DHCP", "Enabled, full range"]]),
    sheet("IPsec phase 1", "VPN › IPsec", [["Key exchange", "IKEv2, IPv4, WAN"], ["Remote gateway", x.f("tn_gw") || "(Zscaler VPN gateway)"], ["Authentication", "Mutual PSK"], ["My identifier", "User distinguished name: " + (x.f("tn_id") || "(Cloudi-Fi VPN ID)")],
      ["Peer identifier", "IP address of the gateway"], ["Pre-shared key", x.f("tn_psk") || "(Cloudi-Fi VPN key)", "secret"], ["Encryption", "AES 256, SHA256, DH 2"], ["Lifetime", "43200"]]),
    sheet("IPsec phase 2", "VPN › IPsec", [["Mode", "Tunnel IPv4"], ["Local network", "VPN Guest subnet"], ["Remote network", "0.0.0.0/0"], ["Protocol", "ESP, AES auto, MD5"], ["PFS", "2"], ["Lifetime", "43200"]]),
    sheet("Firewall", "Firewall › Rules › VPN Guest", [["Rule", "Pass, IPv4, any, VPN Guest net → any"]])
  ], notes: ["DH group 2 and MD5 are as written in the KB. Zscaler also supports stronger sets (AES-256/SHA-256/DH 14) if your build allows."] };
}
function gUnifi(x) {
  return { blocks: [
    sheet("Site-to-site VPN", "Settings › VPN › Site-to-Site › IPsec", [["VPN method", "Route based, tunnel IP on"], ["Remote gateway", x.f("tn_gw") || "(nearest Zscaler VPN node)"], ["Local authentication ID", x.f("tn_id") || "(location FQDN)"], ["Remote ID", "Auto"],
      ["Pre-shared key", x.f("tn_psk") || "(from Cloudi-Fi network parameters)", "secret"], ["IKE", "IKEv2, AES-256, SHA256, DH 14, 86400 s"], ["ESP", "AES-256, SHA256, DH 14, PFS, 43200 s"], ["MTU", "1400"], ["Tunnel address", x.f("uf_tun")]]),
    sheet("Policy-based route", "Settings › Routing › Policy-based", [["Name", "Guest-Zscaler" + x.sfx], ["Interface", "the Zscaler tunnel"], ["Kill switch", "Enabled"], ["Source", "guest VLAN"], ["Destination", "Any"]])
  ], notes: ["The UniFi captive-portal integration itself is marked unavailable in the Cloudi-Fi KB; this tunnel path is the supported UniFi route."] };
}

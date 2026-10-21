"use strict";

/* =================== Troubleshooting =================== */
const tcli = (title, lines, lang, why) => ({ kind: "cli", title, lines, lang: lang || "plain", why });
const tsteps = (title, lines, why) => ({ kind: "steps", title, lines, why });
function macs(m) {
  const h = String(m).toLowerCase().replace(/[^0-9a-f]/g, "").padEnd(12, "0").slice(0, 12);
  const pairs = h.match(/../g);
  return { colon: pairs.join(":"), COLON: pairs.join(":").toUpperCase(), dot: h.slice(0, 4) + "." + h.slice(4, 8) + "." + h.slice(8), dash: h.slice(0, 4) + "-" + h.slice(4, 8) + "-" + h.slice(8), hy: pairs.join("-").toUpperCase() };
}
function tsCommon(x) {
  return [
    tsteps("Client basics (Cloudi-Fi first-level guide)", [
      "Client has a DHCP address on the guest VLAN. No address → DHCP server or L2 path.",
      "Client resolves login.cloudi-fi.net. No answer → DNS server reachability, or DNS isn't allowed pre-auth.",
      "Browse http://neverssl.com or http://3wi.fi. Error page → no Internet path (check the VPN on tunnel deployments). Portal appears → the OS captive check didn't fire; forget and rejoin the SSID. Site loads → client is already authenticated.",
      "Portal itself is up: preview it from Cloudi-Fi › Locations, or open https://login.cloudi-fi.net, which should land on the blue 3wi.fi page."
    ], "Rules out the client and Cloudi-Fi before touching the controller."),
    tcli("Client-side commands", [
      "# Windows", "ipconfig /all", "nslookup login.cloudi-fi.net", "curl -sI http://neverssl.com",
      "# macOS / Linux", "ipconfig getifaddr en0        # macOS; Linux: ip -4 addr", "dig +short login.cloudi-fi.net", "curl -sI http://neverssl.com | head -5",
      "# Expect a 302 Location: pointing at your controller or login.cloudi-fi.net before auth"
    ], "ros"),
    tsteps("Send to Cloudi-Fi support if still stuck", [
      "Client private IP (" + x.tIp + ") and MAC (" + x.tMac + ")",
      "Screenshot of http://ip.zscaler.com from the client",
      "HAR capture of the portal attempt (help.cloudi-fi.com article 9651157007773)",
      "Wireshark capture, plus the portal URL configured on the device"
    ])
  ];
}
const TS = {
  c9800(x) {
    const m = macs(x.tMac), s0 = x.servers[0], fl = x.p.id !== "c9800-local", pm = "Cloudi-Fi" + x.sfx;
    return [
      tcli("RADIUS", ["show aaa servers brief", "show radius server-group all", "ping " + s0, "test aaa group Cloudi-Fi-Group " + x.tUser + " " + x.tPass + " new-code",
        "! Access-Reject = reachable, secret OK. No response = IP, firewall or secret", "show aaa method-lists authentication", "show radius statistics"], "ios", "Proves the controller reaches Cloudi-Fi and the secret matches."),
      tcli("DNS and web auth", ["show hosts", "ping login.cloudi-fi.net", "show parameter-map type webauth name " + pm, "show ip http server status | include HTTP server status|HTTP secure",
        "show urlfilter list " + (fl ? "Walled_Garden" : "WalledGarden"), "show ip access-lists" + (fl ? " Cloudi-Fi_ACL_Flex" : " WA-sec-104.26.5.244")], "ios"),
      tcli("Client state", ["show wireless client summary", "show wireless client mac-address " + m.dot + " detail", "! Policy Manager State: WEBAUTH_REQD = waiting on portal, RUN = authenticated",
        "show wireless client mac-address " + m.dot + " stats"].concat(fl ? ["show ap tag summary", "show wireless profile flex detailed Flex_Profile" + x.sfx] : []), "ios"),
      tcli("RadioActive trace for one client", ["debug wireless mac " + m.dot + " internal monitor-time 900", "! reproduce the login, then stop it:", "no debug wireless mac " + m.dot + " internal",
        "dir bootflash: | include ra_trace", "more bootflash:<ra_trace_file> | include RADIUS|webauth|redirect"], "ios", "Shows every step from association to RUN, including the RADIUS exchange."),
      tcli("Packet capture to the RADIUS servers", ["! VERIFY: set the uplink interface", "monitor capture CF interface TenGigabitEthernet0/1/0 both", "monitor capture CF match ipv4 host " + s0 + " any",
        "monitor capture CF buffer size 50", "monitor capture CF start", "! reproduce, then", "monitor capture CF stop", "monitor capture CF export bootflash:cf-radius.pcap", "no monitor capture CF"], "ios")
    ];
  },
  aireos(x) {
    const m = macs(x.tMac), id = x.f("ai_wlanId") || "5";
    return [
      tcli("RADIUS", ["show radius summary", "ping " + x.servers[0], "test aaa radius username " + x.tUser + " password " + x.tPass + " wlan-id " + id, "test aaa show radius", "show radius auth statistics", "show radius acct statistics"], "plain", "The test result shows which server answered and whether it was Accept, Reject or timeout."),
      tcli("Client and web auth", ["show client summary", "show client detail " + m.colon, "show wlan " + id, "show acl detailed cloudifi_pre-auth", "show custom-web all"], "plain"),
      tcli("Debug one client", ["debug client " + m.colon, "debug aaa events enable", "debug web-auth redirect enable mac " + m.colon, "# reproduce, then", "debug disable-all"], "plain")
    ];
  },
  me(x) {
    const m = macs(x.tMac);
    return [tcli("RADIUS and client (ME runs the AireOS CLI)", ["show radius summary", "ping " + x.servers[0], "test aaa radius username " + x.tUser + " password " + x.tPass + " wlan-id <id>", "test aaa show radius", "show client detail " + m.colon, "debug client " + m.colon, "debug disable-all"], "plain")];
  },
  fortios(x) {
    const s0 = x.servers[0], ip = x.tIp, src = (x.f("fg_obj") || "cf-guest").slice(0, 15);
    return [
      tcli("RADIUS", ["execute ping " + s0, "diagnose test authserver radius Cloudi-Fi_Radius_Srv pap " + x.tUser + " " + x.tPass, "# 'authenticate failed' = reachable, secret OK. 'no response' = IP, firewall or secret",
        "diagnose sniffer packet any 'host " + s0 + " and udp' 4 20 l"], "forti", "GUI equivalent: RADIUS server › Test User Credentials."),
      tcli("RADIUS debug", ["diagnose debug reset", "diagnose debug application fnbamd -1", "diagnose debug console timestamp enable", "diagnose debug enable", "# reproduce a guest login, then", "diagnose debug disable", "diagnose debug reset"], "forti"),
      tcli("DNS and portal", ["execute ping login.cloudi-fi.net", "diagnose firewall fqdn list | grep cloudi", "diagnose firewall auth list", "show user setting", "get system interface | grep -A3 " + src], "forti"),
      tcli("Trace one guest flow", ["diagnose debug reset", "diagnose debug flow filter addr " + ip, "diagnose debug flow show function-name enable", "diagnose debug enable", "diagnose debug flow trace start 50",
        "# browse from the client, then", "diagnose debug disable", "diagnose debug reset"], "forti", "Shows which policy matched and whether captive-portal redirect or exemption applied."),
      tcli("Wireless client (FortiAP)", ["diagnose wireless-controller wlac -d sta online", "diagnose wireless-controller wlac -c vap"], "forti")
    ];
  },
  arubaMC(x) {
    const m = macs(x.tMac);
    return [
      tcli("RADIUS", ["show aaa authentication-server radius statistics", "ping " + x.servers[0], "aaa test-server pap Cloudi-Fi_Primary " + x.tUser + " " + x.tPass, "aaa test-server pap Cloudi-Fi_Secondary " + x.tUser + " " + x.tPass], "plain", "GUI equivalent: Diagnostics › Tools › AAA Server Test."),
      tcli("Client and portal", ["show user-table", "show user ip " + x.tIp, "show user mac " + m.colon, "show aaa authentication captive-portal ssid_ccpm_prof", "show netdestination", "show datapath session table " + x.tIp], "plain"),
      tcli("Debug one client", ["logging level debugging user-debug " + m.colon, "show log user-debug 50", "no logging level debugging user-debug " + m.colon], "plain")
    ];
  },
  arubaInstant(x) {
    const m = macs(x.tMac);
    return [
      tcli("RADIUS (Instant / Central remote console)", ["ping " + x.servers[0], "aaa test-server <server_name> username " + x.tUser + " password " + x.tPass + " auth-type pap", "show ap debug radius-statistics", "show ap debug auth-trace-buf"], "plain",
        "The KB writes 'authtype pap,' with a trailing comma; drop the comma if the command errors."),
      tcli("Client and portal", ["show clients", "show client " + m.colon, "show datapath user", "show datapath session | include " + x.tIp, "show network <ssid-profile>"], "plain")
    ];
  },
  arubaIon(x) { return [tsteps("Instant On has no CLI", ["Site › Clients › select the client: check it's on the guest network and its state.", "Site › Diagnostics › Ping / DNS lookup: target " + x.servers[0] + " and login.cloudi-fi.net.", "Re-enter the RADIUS secret if logins fail after the portal; Instant On won't tell you it's wrong."])]; },
  ruckus(x) {
    const one = x.p.id === "ruckus-one";
    return [
      tsteps("RADIUS", one ? ["Network › Authentication › Cloudi-Fi Radius › Test (if offered), else check Events for RADIUS timeouts.", "Confirm venue APs show the network as active."] :
        ["Services & Profiles › Authentication › Proxy (SZ Authenticator) › Cloudi-Fi Radius › Test AAA with " + x.tUser + " / " + x.tPass + ".", "Timeout = server IP, firewall (UDP 1812/1813) or secret."]),
      tcli("AP CLI (SSH to an AP)", ["get station wlan<n> list", "get station wlan<n> stats " + macs(x.tMac).colon, "ping " + x.servers[0]], "plain"),
      tsteps("Portal", one ? ["Check the WISPr portal URL on the network equals the generated URL.", "Integration key in Cloudi-Fi matches the one shown in RUCKUS One."] :
        ["Confirm no encrypt-mac-ip is in the running config (show running-config | include encrypt).", "NBI: TCP 9080/9443 open, and the NBI username/password in Cloudi-Fi match.", "Clients › Wireless Clients › client: Auth Status should move from Unauthorized to Authorized."])
    ];
  },
  mikrotik(x) {
    const m = macs(x.tMac);
    return [
      tcli("RADIUS", ["/radius print detail", "/ping " + x.servers[0] + " count=3", "/radius monitor 0 once", "/system logging add topics=radius,debug action=memory", "/log print where topics~\"radius\"",
        "/tool sniffer quick ip-address=" + x.servers[0]], "ros", "monitor shows pending, rejects and timeouts per server."),
      tcli("DNS, walled garden and hotspot", ["/resolve login.cloudi-fi.net", "/ip hotspot walled-garden print", "/ip hotspot host print where mac-address=" + m.COLON, "/ip hotspot active print", "/ip hotspot profile print detail", "/file print where name~\"hotspot\""], "ros"),
      tcli("Remove the debug logging afterwards", ["/system logging remove [find topics~\"radius\"]"], "ros")
    ];
  },
  extremeCIQ(x) {
    return [tcli("HiveOS AP CLI (Manage › Devices › CLI access)", ["ping " + x.servers[0], "show station", "show auth", "show interface wifi0.1", "show interface wifi1.1", "show logging buffered | include radius|cwp"], "plain", "The KB uses show interface wifi0.1 / wifi1.1 to find the AP's portal IP."),
      tsteps("CloudIQ", ["Monitor › Clients › client › Client 360 for auth timeline.", "Confirm Supplemental CLI deployed (aaa attribute NAS-Identifier) with a Complete Configuration Update."])];
  },
  wing(x) {
    return [tcli("WiNG CLI", ["ping login.cloudi-fi.net", "show wireless client", "show wireless client detail " + macs(x.tMac).hy, "! VERIFY on your WiNG release:", "show captive-portal client"], "ios"),
      tsteps("Portal", ["DNS whitelist Cloudi-Fi-Whitelist is bound to CAP-Cloudi-Fi and Match Suffix is ticked.", "Commit and Save after any change."])];
  },
  meraki(x) {
    const tun = x.p.id === "meraki-tunnel";
    return tun ? [tsteps("Tunnel", ["Security & SD-WAN › VPN status › Non-Meraki peers: tunnel must be green.", "Event log, filter Non-Meraki VPN: IKE/phase-2 mismatches show here.", "From a guest client, http://ip.zscaler.com should show a Zscaler node."])]
      : [tsteps("Dashboard tools", [
        x.p.id === "meraki-radius" ? "Wireless › Access control › RADIUS servers › Test, with " + x.tUser + " / " + x.tPass + "." : "Cloudi-Fi › Integrations › Meraki: check the last sync and that the SSID shows as configured.",
        "AP › Tools › Ping " + (x.p.id === "meraki-radius" ? x.servers[0] : "login.cloudi-fi.net") + " and DNS lookup login.cloudi-fi.net.",
        "Network-wide › Event log, filter Splash or RADIUS for the client " + x.tMac + ".",
        "Network-wide › Packet capture on the AP, filter 'host " + x.tIp + "' to see the redirect."])];
  },
  mist(x) { return [tsteps("Mist", ["Monitor › Insights › Client " + x.tMac + ": guest-portal events in order.", "WLAN › Guest portal: portal URL and API secret match Cloudi-Fi.", "Allowed hostnames include " + x.wg.all.join(", ") + "."])]; },
  huawei(x) {
    const relay = x.p.id !== "huawei-api";
    return [tcli("AP / gateway CLI", ["ping " + x.servers[0], "display access-user", "display access-user mac-address " + macs(x.tMac).dash].concat(relay ? ["display radius-server configuration template Cloudi-Fi-Radius", "! VERIFY template name on the device:", "test-aaa " + x.tUser + " " + x.tPass + " radius-template Cloudi-Fi-Radius pap"] : []), "plain"),
      tsteps("NCE-Campus", ["Monitoring › Users › Online users for the client.", "Confirm the Cloudi-Fi-ACL default permit rule includes DNS and *.cloudi-fi.net.", "The KB's troubleshooting section mentions Aruba commands by mistake; use the above instead."])];
  },
  steps(name) {
    return x => [tsteps(name + " tools", ["Cloud dashboard › device › Tools: ping " + (x.servers ? x.servers[0] : "") + " and DNS lookup login.cloudi-fi.net.", "Client list › " + x.tMac + ": check guest network and auth state.", "If logins fail after the portal: re-enter the RADIUS secret and check UDP 1812/1813 outbound."])];
  },
  cradle(x) { return [tcli("NCOS CLI (NCM › Remote Connect › Console)", ["ping " + x.servers[0], "nslookup login.cloudi-fi.net", "log -s hotspot", "log -s radius"], "plain"), tsteps("Hotspot", ["UAM secret on the router matches what Cloudi-Fi support has.", "Allowed hosts include *.cloudi-fi.net and *.cloudi-fi.com."])]; },
  palo(x) {
    return [tcli("PAN-OS CLI", ["ping source <guest-interface-ip> host login.cloudi-fi.net", "show dns-proxy cache all", "show user ip-user-mapping ip " + x.tIp, "show session all filter source " + x.tIp,
      "test security-policy-match from Guest to External source " + x.tIp + " destination 1.1.1.1 destination-port 443 protocol 6", "show counter global filter delta yes | match captive"], "plain", "Unknown user + whitelist rule hit before login, known-user + Guest-Allowed after."),
      tsteps("SAML", ["The redirect host " + (x.f("pa_host") || "") + " resolves to the guest interface (or Prisma redirect IP) from the client.", "Certificate on the captive portal matches that FQDN.", "Device › Authentication profile › Cloudi-Fi: username attribute token, group attribute profile."])];
  },
  versa(x) { return [tsteps("Versa", ["Monitor › Devices › Services › Captive portal for the client session.", "DNS proxy resolves cloudi-fi.versa-networks.com to the CPE LAN IP from the client.", "If SSO fails, switch the SSO URL to the /start/<ch>/<lh> form and retest."])]; },
  pfsense(x) { return [tcli("pfSense shell (Diagnostics › Command Prompt)", ["swanctl --list-sas", "ping -S " + String(x.f("pf_net")).split("/")[0] + " -c 3 8.8.8.8", "pfctl -ss | grep " + x.tIp, "clog /var/log/ipsec.log | tail -40"], "ros", "No SA = phase 1/2 mismatch or wrong VPN ID / PSK."), tsteps("Client", ["http://ip.zscaler.com should show a Zscaler node, then the Cloudi-Fi portal on first browse."])]; },
  unifi(x) { return [tcli("Gateway SSH", ["swanctl --list-sas", "ip route show table all | grep -i vti", "ping -c 3 " + (x.f("tn_gw") || "<zscaler-node>")], "ros"), tsteps("UniFi", ["Settings › VPN › Site-to-Site: tunnel uptime increasing.", "Insights › Flows: guest traffic leaving through the tunnel.", "Policy route kill switch on: if the tunnel is down guests get no Internet, which is expected."])]; }
};
const TSMAP = { "c9800-local": "c9800", "c9800-flexls": "c9800", "c9800-flexcs": "c9800", aireos: "aireos", me: "me", fortios: "fortios", "aruba-mc": "arubaMC", "aruba-iap": "arubaInstant", "aruba-central": "arubaInstant", "aruba-airwave": "arubaInstant",
  "aruba-ion": "arubaIon", "ruckus-vsz6": "ruckus", "ruckus-vsz5": "ruckus", "ruckus-one": "ruckus", mikrotik: "mikrotik", "extreme-ciq": "extremeCIQ", "extreme-wing": "wing", "meraki-api": "meraki", "meraki-radius": "meraki", "meraki-tunnel": "meraki",
  "juniper-mist": "mist", "huawei-portal": "huawei", "huawei-radius": "huawei", "huawei-api": "huawei", cradlepoint: "cradle", "palo-strata": "palo", "palo-prisma": "palo", versa: "versa", pfsense: "pfsense", "unifi-ipsec": "unifi",
  alcatel: ["steps", "OmniVista / Stellar AP"], cambium: ["steps", "cnMaestro (Troubleshoot › Tools)"], engenius: ["steps", "EnGenius Cloud"], peplink: ["steps", "Peplink (Status › Ping/Traceroute)"], zyxel: ["steps", "Nebula"] };
function troubleshoot(x) {
  const k = TSMAP[x.p.id];
  const vend = Array.isArray(k) ? TS.steps(k[1])(x) : TS[k](x);
  return x.p.url === "none" ? vend.concat(tsCommon(x).slice(2)) : tsCommon(x).slice(0, 1).concat(vend, tsCommon(x).slice(1));
}

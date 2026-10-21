"use strict";

/* ---------- Platform catalogue -------------------------------------------
   url:  sp     -> replace /sp/<x> with /sp/<sp>
         split  -> same, then also split into host + path for "host/page" UIs
         saml2  -> https://login.cloudi-fi.net/start/<ch>/<lh>  (Palo Alto)
         saml1  -> https://login.cloudi-fi.net/start/<ch>       (Versa)
         asis   -> use the copied URL unchanged (KB gives no sp value)
         integ  -> URL comes from the Cloudi-Fi integration screen
         none   -> no portal URL (tunnel deployments)
   wg:   wild | suffix | none ;  core: platform's required walled-garden entries */
const C9 = [
  { id: "c9_wlanId", label: "WLAN ID", type: "number", def: "10" },
  { id: "c9_vip", label: "Virtual IPv4", def: "192.0.2.2" },
  { id: "c9_acl", label: "Custom pre-auth ACL (lock DNS to specific resolvers)", type: "check" },
  { id: "c9_dns", label: "DNS servers for the ACL", def: "1.1.1.1, 9.9.9.9", showIf: "c9_acl" },
  { id: "c9_aps", label: "Apply tags to APs", hint: "AP Ethernet MACs, one per line, any format", type: "area" },
  { id: "c9_skip", label: "RADIUS / AAA already on this controller (site objects only)", type: "check" },
  { id: "c9_comments", label: "Include section comments", type: "check", def: true },
  { id: "c9_wr", label: "End with write memory", type: "check", def: true }
];
const C9FLEX = [
  { id: "c9_native", label: "Flex native VLAN ID", def: "1" },
  { id: "c9_vlanid", label: "Guest VLAN ID at the AP (for the Flex profile)", def: "20" }
];
const P = [
  { id: "c9800-local", vendor: "Cisco Catalyst", name: "WLC 9800 · Local Mode", kb: "9651117910941", sp: "spcisco.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.net"], fields: C9, gen: g9800 },
  { id: "c9800-flexls", vendor: "Cisco Catalyst", name: "WLC 9800 · FlexConnect local switching", kb: "26461872318365", sp: "spcisco.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.net"], fields: C9FLEX.concat(C9), gen: g9800 },
  { id: "c9800-flexcs", vendor: "Cisco Catalyst", name: "WLC 9800 · FlexConnect central switching", kb: "25224044716573", sp: "spcisco.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.net"], fields: C9FLEX.concat(C9), gen: g9800 },
  { id: "aireos", vendor: "Cisco AireOS", name: "WLC 5520 / AireOS · Local Mode", kb: "9651156334749", sp: "spcisco.com", url: "sp", radius: true, key: true, wg: "none", fields: [
      { id: "ai_wlanId", label: "WLAN ID", type: "number", def: "5" },
      { id: "ai_intf", label: "Guest dynamic interface name", def: "guest" },
      { id: "ai_dns", label: "Guest DNS server for the pre-auth ACL", def: "8.8.8.8" },
      { id: "ai_sess", label: "Session timeout (s)", def: "720", hint: "KB value; most deployments use the portal lifetime" },
      { id: "ai_flex", label: "FlexConnect local switching (KB enables it)", type: "check" }
    ], gen: gAireos },
  { id: "me", vendor: "Cisco AireOS", name: "Mobility Express", kb: "9651117261469", sp: "spcisco.com", url: "sp", radius: true, wg: "none", fields: [], gen: gME },
  { id: "meraki-api", vendor: "Cisco Meraki", name: "Meraki MR / MX · API integration", kb: "9651192136093", url: "integ", radius: false, wg: "wild", core: ["*.cloudi-fi.net"], fields: [
      { id: "mk_dev", label: "Device", type: "select", opts: [["mr", "MR (wireless)"], ["mx", "MX (security appliance)"]] }
    ], gen: gMerakiApi },
  { id: "meraki-radius", vendor: "Cisco Meraki", name: "Meraki MR · RADIUS (MAC-based)", kb: "10921670881565", url: "integ", radius: true, wg: "none", fields: [], gen: gMerakiRad },
  { id: "meraki-tunnel", vendor: "Cisco Meraki", name: "Meraki MX · IPsec tunnel to Zscaler", kb: "9651157645085", url: "none", radius: false, wg: "none", fields: [
      { id: "tn_gw", label: "Zscaler VPN gateway (public IP)", def: "" },
      { id: "tn_id", label: "Cloudi-Fi VPN key / FQDN", def: "" },
      { id: "tn_psk", label: "Cloudi-Fi VPN secret (PSK)", type: "password", def: "" }
    ], gen: gMerakiTun },
  { id: "fortios", vendor: "Fortinet", name: "FortiGate / FortiOS", kb: "9651187677213", sp: "spforti.com", url: "sp", radius: true, wg: "wild", core: CF_CORE.slice(0, 5), fields: [
      { id: "fg_mode", label: "Portal on", type: "select", opts: [["vap", "FortiAP SSID (WiFi controller)"], ["intf", "FortiGate interface / VLAN"]] },
      { id: "fg_obj", label: "SSID interface name or guest interface", def: "cf-guest", hint: "VAP name (max 15 chars) or e.g. port5 / guest-vlan" },
      { id: "fg_wan", label: "WAN interface", def: "wan1" },
      { id: "fg_deny", label: "Add Guest-Deny-All to RFC1918", type: "check", def: true },
      { id: "fg_https", label: "HTTPS redirection with your certificate", type: "check" },
      { id: "fg_cert", label: "Certificate name on the FortiGate", def: "guest-cert", showIf: "fg_https" },
      { id: "fg_fqdn", label: "Portal FQDN (resolves to guest interface IP)", def: "guest.example.com", showIf: "fg_https" },
      { id: "fg_v706", label: "FortiOS 7.0.6+ (per-interface portal address)", type: "check", def: true, showIf: "fg_https" }
    ], gen: gForti },
  { id: "aruba-mc", vendor: "HPE Aruba", name: "Mobility Controller (AOS 8)", kb: "9651157286173", sp: "spvcaruba.com", url: "split", radius: true, wg: "wild", core: ["*.cloudi-fi.net", "fonts.googleapis.com"], fields: [
      { id: "ar_fqdn", label: "Controller certificate FQDN", def: "guest.example.com" }
    ], gen: gArubaMC },
  { id: "aruba-iap", vendor: "HPE Aruba", name: "Instant AP", kb: "9651190125597", sp: "sparuba.com", url: "split", radius: true, wg: "wild", core: CF_CORE.slice(0, 4), fields: [], gen: gArubaIAP },
  { id: "aruba-central", vendor: "HPE Aruba", name: "Aruba Central", kb: "9651145487133", sp: "sparuba.com", url: "split", radius: true, wg: "wild", core: ["login.cloudi-fi.net"], fields: [], gen: gArubaCentral },
  { id: "aruba-airwave", vendor: "HPE Aruba", name: "AirWave (Instant)", kb: "9651149825693", sp: "sparuba.com", url: "split", radius: true, key: true, wg: "wild", core: ["login.cloudi-fi.net", "login-cn.cloudi-fi.net"], fields: [], gen: gArubaAirwave },
  { id: "aruba-ion", vendor: "HPE Aruba", name: "Instant On", kb: "9651110760733", sp: "sparubaiao.com", url: "sp", radius: true, wg: "wild", core: ["login.cloudi-fi.net"], fields: [], gen: gArubaIon },
  { id: "ruckus-vsz6", vendor: "CommScope Ruckus", name: "SmartZone vSZ 6.x", kb: "9651150329629", sp: "spruckusnbi.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.net", "*.cloudi-fi.com"], fields: [
      { id: "rk_nbiu", label: "NBI username (also entered in Cloudi-Fi)", def: "cloudifi" }
    ], gen: gRuckus },
  { id: "ruckus-vsz5", vendor: "CommScope Ruckus", name: "SmartZone vSZ 5.x", kb: "9651155085341", sp: "spruckusnbi.com", url: "sp", radius: true, key: true, wg: "wild", core: ["*.cloudi-fi.net", "*.cloudi-fi.com"], fields: [
      { id: "rk_nbiu", label: "NBI username (also entered in Cloudi-Fi)", def: "cloudifi" }
    ], gen: gRuckus },
  { id: "ruckus-one", vendor: "CommScope Ruckus", name: "RUCKUS One (cloud)", kb: "9651117120541", sp: "spruckusnbi.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.net"], fields: [], gen: gRuckusOne },
  { id: "mikrotik", vendor: "MikroTik", name: "RouterOS Hotspot", kb: "9747983513757", sp: "spmikrotik.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.com", "*.cloudi-fi.net", "*.3wi.fi"], fields: [
      { id: "mt_mac", label: "Router MAC (hotspot name / Location ID)", def: "AA:BB:CC:DD:EE:FF" },
      { id: "mt_prof", label: "Hotspot server profile", def: "hsprof1" },
      { id: "mt_cert", label: "Imported certificate name", def: "" }
    ], gen: gMikrotik },
  { id: "extreme-ciq", vendor: "Extreme Networks", name: "ExtremeCloud IQ (Aerohive)", kb: "9651188895901", sp: "spextremecloudiq.com", url: "sp", radius: true, key: true, wg: "wild", core: ["*.cloudi-fi.net"], fields: [
      { id: "ex_prof", label: "Cloudi-Fi profile name for CWP bypass (optional)", def: "", hint: "Avoids re-splash after 30 min idle" }
    ], gen: gExtremeCIQ },
  { id: "extreme-wing", vendor: "Extreme Networks", name: "WiNG (no RADIUS)", kb: "9651156389661", url: "asis", radius: false, wg: "suffix", core: ["cloudi-fi.net"], fields: [], gen: gWing },
  { id: "juniper-mist", vendor: "Juniper", name: "Mist", kb: "9651156931613", url: "integ", radius: false, wg: "suffix", core: ["cloudi-fi.net", "cloudi-fi.com"], fields: [], gen: gMist },
  { id: "huawei-portal", vendor: "Huawei", name: "iMaster NCE-Campus · Third-party portal", kb: "16688109925533", sp: "sphuaweiap.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.net", "*.huawei.com"], fields: [
      { id: "hw_key", label: "Portal key (share with Cloudi-Fi support)", def: "" }
    ], gen: gHuaweiPortal },
  { id: "huawei-radius", vendor: "Huawei", name: "iMaster NCE-Campus · RADIUS relay", kb: "15627818001309", sp: "sphuaweiap.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.net", "*.huawei.com"], fields: [], gen: gHuaweiRadius },
  { id: "huawei-api", vendor: "Huawei", name: "iMaster NCE-Campus · API", kb: "9651113530269", sp: "sphuaweicloud.com", url: "sp", radius: false, wg: "none", fields: [
      { id: "hw_apiu", label: "API username", def: "huawei_api_cloudifi" }
    ], gen: gHuaweiApi },
  { id: "alcatel", vendor: "Alcatel-Lucent", name: "OmniVista 2500 · RADIUS", kb: "12300177735709", sp: "spalcatel.com", url: "split", radius: true, wg: "wild", core: ["*.cloudi-fi.net"], fields: [
      { id: "al_cn", label: "China location (portal server login-cn)", type: "check" }
    ], gen: gAlcatel },
  { id: "cambium", vendor: "Cambium", name: "cnMaestro", kb: "9651152603805", sp: "spcambiumct.com", url: "sp", radius: true, wg: "none", fields: [
      { id: "cb_host", label: "Guest portal hostname (certificate CN)", def: "guest.example.com" }
    ], gen: gCambium },
  { id: "cradlepoint", vendor: "Cradlepoint", name: "NetCloud Manager", kb: "9651116572829", sp: "spcradlepoint.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.com", "*.cloudi-fi.net"], fields: [
      { id: "cp_uam", label: "UAM secret (define, then share with Cloudi-Fi)", def: "" }
    ], gen: gCradle },
  { id: "engenius", vendor: "EnGenius", name: "EnGenius Cloud", kb: "9651116241565", sp: "spenginius.com", url: "sp", radius: true, wg: "wild", core: ["*.cloudi-fi.com", "*.cloudi-fi.net"], fields: [], gen: gEngenius },
  { id: "peplink", vendor: "Peplink", name: "Peplink / InControl", kb: "9651092387997", sp: "sppeplink.com", url: "sp", radius: true, key: true, wg: "suffix", core: ["cloudi-fi.net"], fields: [
      { id: "pp_host", label: "Captive portal hostname", def: "guest.3wi.fi", hint: "Cloudi-Fi's domain; works with their public certificate" }
    ], gen: gPeplink },
  { id: "zyxel", vendor: "Zyxel", name: "Nebula", kb: "9651147556637", sp: "spzyxel.com", url: "sp", radius: false, wg: "wild", core: ["*.cloudi-fi.net", "*.cloudi-fi.com"], fields: [], gen: gZyxel },
  { id: "palo-strata", vendor: "Palo Alto Networks", name: "Strata NGFW (SAML)", kb: "9651186474909", url: "saml2", radius: false, wg: "wild", core: ["login.cloudi-fi.net", "guest-api-v1.cloudi-fi.net"], fields: [
      { id: "pa_host", label: "Captive portal redirect host (FQDN)", def: "guest.example.com" }
    ], gen: gPalo },
  { id: "palo-prisma", vendor: "Palo Alto Networks", name: "Prisma Access (SAML)", kb: "9651186957341", url: "saml2", radius: false, wg: "wild", core: ["*.cloudi-fi.net"], fields: [
      { id: "pa_host", label: "Captive portal redirect host (FQDN)", def: "guest.example.com" }
    ], gen: gPalo },
  { id: "versa", vendor: "Versa Networks", name: "Versa SD-WAN (SAML)", kb: "9651153687197", url: "saml1", radius: false, wg: "wild", core: ["*.cloudi-fi.net"], fields: [], gen: gVersa },
  { id: "pfsense", vendor: "pfSense", name: "IPsec tunnel to Zscaler", kb: "9651118566429", url: "none", radius: false, wg: "none", fields: [
      { id: "tn_gw", label: "Zscaler VPN gateway (public IP)", def: "" },
      { id: "tn_id", label: "Cloudi-Fi VPN ID", def: "" },
      { id: "tn_psk", label: "Cloudi-Fi VPN key (PSK)", type: "password", def: "" },
      { id: "pf_net", label: "Guest subnet", def: "192.168.5.1/24" }
    ], gen: gPfsense },
  { id: "unifi-ipsec", vendor: "Ubiquiti", name: "UniFi · IPsec tunnel to Zscaler", kb: "37778145640477", url: "none", radius: false, wg: "none", fields: [
      { id: "tn_gw", label: "Nearest Zscaler VPN hostname", def: "" },
      { id: "tn_id", label: "Location FQDN (Cloudi-Fi network parameters)", def: "" },
      { id: "tn_psk", label: "Pre-shared key", type: "password", def: "" },
      { id: "uf_tun", label: "Tunnel interface address", def: "10.254.254.1/30" }
    ], gen: gUnifi }
];
/* KB articles already built into this page. The KB-refresh scheduled task diffs the live KB against this list. */
const KB_INDEX = {
  checked: "2026-10-16",
  shared: ["9651112648349 Set up a Walled Garden", "9651148542749 Radius and Syslog Servers", "9651151305757 First level troubleshooting"],
  skipped: ["9651187571357 FortiGate HTTPS redirection (folded into FortiOS)", "18913751031965 FortiOS multiple portals (folded into FortiOS)", "9651156500893 CloudIQ 30 min inactivity (folded into CloudIQ)",
    "14668602582045 UniFi controller (marked unavailable in KB)", "9651152399261 UniFi legacy (marked unavailable in KB)", "Zscaler tenant, certificate, syslog and iOS recognition articles (no device config)"],
  articles: P.map(p => ({ id: p.kb, platform: p.id }))
};
const REFRESH_TASK = "trig_01HCz7Mtsez6RLVL4aZSq2hS";

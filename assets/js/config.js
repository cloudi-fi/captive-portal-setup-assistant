"use strict";
/* Cloudi-Fi infrastructure shared by every platform: RADIUS servers, portal endpoints, walled-garden domains per login method. */
const KB = "https://help.cloudi-fi.com/hc/en-us/articles/";
const SUCCESS = "https://login.cloudi-fi.net/success.php";
const RADIUS = { amer: ["87.98.173.68", "54.37.221.71", "51.210.1.45", "57.128.124.84"], apac: ["47.57.139.198"] };
const CF_CORE = ["login.cloudi-fi.net", "login-cn.cloudi-fi.net", "guest-api-v1.cloudi-fi.net", "cdn.cloudi-fi.net", "*.cloudi-fi.net", "*.cloudi-fi.com"];
const CF_IP = "178.33.251.41";
const SAML_IDP = "https://login.cloudi-fi.net/auth/saml2/idp/metadata.php";

const VENDORS = [
  { id: "facebook", name: "Facebook", d: ["facebook.com", "*.facebook.com", "*.fbcdn.net", "*.akamaihd.net", "*.akamai.net", "*.edgecastcdn.net"] },
  { id: "google", name: "Google", d: ["accounts.google.com", "*.gstatic.com", "apis.google.com", "*.googleapis.com"] },
  { id: "microsoft", name: "Microsoft / Entra", d: ["*.microsoftonline.com", "*.live.com", "*.msftauth.net", "*.microsoft.com", "*.msauth.net", "*.msauthimages.net"] },
  { id: "linkedin", name: "LinkedIn", d: ["linkedin.com", "*.linkedin.com", "*.licdn.com"] },
  { id: "x", name: "X / Twitter", d: ["twitter.com", "*.x.com", "*.twitter.com", "*.twimg.com", "*.fastly.net", "*.licdn.net", "*.cloudfront.net"] },
  { id: "okta", name: "Okta", d: ["*.oktacdn.com", "*.okta.com", "*.typekit.net"] },
  { id: "onelogin", name: "OneLogin", d: ["*.onelogin.com"] },
  { id: "ping", name: "Ping Identity", d: ["*.pingidentity.com", "*.pingone.com", "*.auth.pingone.com", "*.pingid.com"] },
  { id: "stripe", name: "Stripe", d: ["api.stripe.com", "checkout.stripe.com", "files.stripe.com", "js.stripe.com", "m.stripe.com", "m.stripe.network", "q.stripe.com"] },
  { id: "tiktok", name: "TikTok", d: ["tiktok.com", "*.tiktok.com", "tiktokcdn.com", "*.tiktokcdn.com", "m.tiktok.com", "www.tiktok.com", "log.tiktok.com"] },
  { id: "pinterest", name: "Pinterest", d: ["*.pinterest.com", "pinterest.com", "*.pinimg.com"], needs: ["facebook", "google"] },
  { id: "line", name: "LINE", d: ["*.line.me", "*.line-scdn.net"] },
  { id: "kakao", name: "Kakao", d: ["*.kakao.com", "*.daumcdn.net", "*.kakaocdn.net", "*.daum.net"] }
];

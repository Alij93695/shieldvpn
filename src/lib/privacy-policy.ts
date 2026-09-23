/**
 * GENERATED from privacy_policy.txt by scripts/build-privacy-policy.js.
 * Do not edit by hand — edit privacy_policy.txt and run `npm run policy`.
 *
 * Google Play requires the policy to be linked or included within the app, so
 * the full text ships here and renders with no network.
 */

export const PRIVACY_POLICY_EFFECTIVE = "Effective Date: 23 September 2026 · Last Updated: 23 September 2026";

export const PRIVACY_POLICY_CONTACT = "alij93695@gmail.com";

export const PRIVACY_POLICY_SECTIONS: { heading: string; body: string }[] = [
  {
    "heading": "1. Introduction",
    "body": "ShieldVPN (\"the app\") is a free VPN client for Android that uses the OpenVPN protocol. This policy explains what the app does with your information, and — just as importantly — what it cannot control.\n\nPlease read section 3 carefully. ShieldVPN does not operate its own VPN servers."
  },
  {
    "heading": "2. Information ShieldVPN Collects",
    "body": "ShieldVPN does not operate any backend servers and does not have user accounts. The app does not collect, store, or transmit:\n\n• Your browsing history\n• The contents of your traffic\n• Your IP address or DNS queries (except as the network requests below necessarily reveal it)\n• Any personally identifying information\n\nThe only thing the app saves is whether you have accepted its disclosure, and it saves that on your own device. Your selected region never leaves the device. There is no ShieldVPN server to send anything to.\n\nThe app makes two kinds of network request on its own behalf. Like any web request, each one reveals your IP address to the host it contacts. Neither carries personal information or any identifier. They normally happen before the tunnel is up; if the VPN is already connected, they travel through it.\n\nServer list: the app downloads the server directory from a public community mirror hosted on GitHub (raw.githubusercontent.com, with jsDelivr as a fallback), falling back to vpngate.net. The request carries no identifier.\n\nServer checks: when you tap Connect, the app contacts a sample of candidate VPN servers directly (up to about 50 at a time) to measure which ones are reachable and fastest from your network. Each check opens a connection to the server and closes it without logging in or sending any of your data. The operators of those servers can see that your IP address connected.\n\nThe app contains no analytics, advertising, crash-reporting or update-checking services. App updates are delivered only through Google Play."
  },
  {
    "heading": "3. Third-Party VPN Servers (Important)",
    "body": "ShieldVPN does not run its own VPN infrastructure. It connects you to free, volunteer-run servers published by the VPNGate project, an academic experiment operated by the University of Tsukuba, Japan (https://www.vpngate.net/).\n\nThis means:\n\n• Your traffic is carried by volunteer server operators who are unknown to us and whom we do not control, audit, or have any agreement with.\n• The VPNGate project states that it retains connection logs (including source IP addresses and connection timestamps) for a period of time, and that logs may be disclosed to authorities where legally required. See VPNGate's own policy for current details.\n• Individual volunteer operators may independently log or inspect traffic passing through their servers.\n\nShieldVPN therefore CANNOT and DOES NOT promise a \"no-logs\" VPN service. Any such claim would be false. Do not use ShieldVPN for traffic where interception by an unknown third party would harm you.\n\nAlways use HTTPS. A VPN tunnel protects traffic between your device and the volunteer server; it does not protect traffic beyond that server."
  },
  {
    "heading": "4. DNS",
    "body": "While you are connected, the app directs DNS queries inside the tunnel to public resolvers (Cloudflare 1.1.1.1 and Google 8.8.8.8), and Android may also use any DNS server that the VPN server provides. The VPN server's operator can see these lookups; public resolvers see the VPN server's address rather than yours. Those providers operate under their own privacy policies."
  },
  {
    "heading": "5. Permissions",
    "body": "• VPN (BIND_VPN_SERVICE): required to create the encrypted tunnel.\n• Notifications: required by Android to show the ongoing connection status while the VPN is active.\n• Network state: required to detect connectivity changes and reconnect."
  },
  {
    "heading": "6. Encryption",
    "body": "Connections use the OpenVPN protocol. Because the app connects to community servers, the available cipher suites are determined by each server operator and may include older configurations."
  },
  {
    "heading": "7. Children",
    "body": "ShieldVPN is not directed at children under 13 and does not knowingly collect information from them."
  },
  {
    "heading": "8. Changes",
    "body": "This policy may be updated. Material changes will be reflected by the \"Last Updated\" date above."
  }
];

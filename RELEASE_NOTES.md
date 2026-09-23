# Release notes

## 1.0.4 (Build 5) — Connection Fixes & Global Servers

Following the naming used for 1.0.3 (Build 4).

### Play Console "What's new"

Paste as-is. One line per bullet — Play keeps line breaks, so hard-wrapped
lines would render as broken sentences. 487 characters (limit 500).

```
Fixes the bugs that stopped connections working, and adds thousands of servers worldwide.
• Fixed: the VPN service was never registered with Android, so it could not start
• Fixed: two crashes in the VPN service on every connection attempt
• Fixed: internet dropping while connected (no DNS inside the tunnel)
• Added: ~4,500 servers across ~70 countries
• Added: servers are timed from your phone; the fastest is tried first, dead ones skipped
• Works on networks that block vpngate.net
```

### What actually changed

**Why it could not connect.** Several independent faults, each sufficient on
its own to stop every connection:

1. `de.blinkt.openvpn.core.OpenVPNService` was never declared in the merged
   AndroidManifest — the OpenVPN library ships an empty `<application>` block —
   so Android refused to start the service. Fixed by `plugins/withOpenVPN.js`.
2. The native module did not compile against React Native 0.85
   (`ActivityEventListener` became non-null). Fixed in `patches/`.
3. Native libraries were not extracted at install, so the OpenVPN binary could
   not be executed from `nativeLibraryDir`. Fixed with legacy JNI packaging.
4. The service crashed with a NullPointerException on every connect: with the
   notification's disconnect action enabled it called `requireNonNull` on a
   button title the app never passed. Fixed in the app and in `patches/`.
5. The service scheduled a persisted `keepVPNAlive` job for a JobService the
   library never declares, so JobScheduler threw on every connect. The call is
   removed in `patches/`.

Also fixed in the library: a start intent without notification settings (for
example Android's always-on VPN) nulled them and crashed the next notification
update; and the disconnect dialog's Reconnect button launched a `LogWindow`
activity that does not exist. The app now disconnects from the notification
immediately.

Separately, the VPN screen was not reachable at all: the app entry is
`expo-router`, which renders `src/app/`, while the VPN code lived in an unused
`App.js`.

**Why the internet died when it did connect.** No DNS server was set inside the
tunnel, so the device kept its old LAN resolver, which is unroutable once the
tunnel takes the default route. Every lookup failed. Also added IPv6 leak
blocking, an MTU clamp for hosts that drop full-size packets, and
`persistTun: false` so a dying tunnel releases the interface instead of
black-holing traffic.

**Servers.** Now sourced from a community mirror that accumulates VPN Gate
rotations — ~4,500 usable servers across ~70 countries — instead of the
99-server, 9-country rotating sample the official API returns. The mirror is
also reachable on networks that block `vpngate.net`.

**Server selection.** At connect time the app times up to ~48 candidates from
the phone itself (TCP connect plus TLS handshake against the server's own
port) and dials the fastest that answered. Servers that refuse, reset or time
out are never dialled. Measured from a UAE network, 28 of 42 servers the mirror
listed as usable did not answer, which is why this matters. Each downloaded
profile must point at the exact IP and port that was measured.

**Compliance.** In-app prominent disclosure and consent gate (required by
Google's VpnService policy), the privacy policy readable from the main screen,
an open-source licences screen with the full licence texts, GPL v2 licensing
with a link to the source and a written offer of source, and five unused
permissions removed: `SYSTEM_ALERT_WINDOW`,
`READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `VIBRATE` and
`RECEIVE_BOOT_COMPLETED`.

### Versioning

| Version | Build | Track | Date |
| --- | --- | --- | --- |
| 1.0.4 | 5 | (this release) | — |
| 1.0.3 | 4 | Internal testing | 11 Jun 2026 |
| 1.0.2 | 3 | — | 10 Jun 2026 |
| 1.0.1 | 2 | — | 10 Jun 2026 |
| 1.0.0 | 1 | Closed testing – Alpha | 10 Jun 2026 |

A locally built 1.1.3 / versionCode 14 exists in the older checkout but was
never uploaded; Play only knows versionCodes 1–4, so 5 is correct.

Next release is **versionCode 6**: bump `android.versionCode` in `app.json`,
then run `npx expo prebuild -p android` so the change reaches the native project.

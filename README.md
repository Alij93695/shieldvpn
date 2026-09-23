# ShieldVPN

ShieldVPN is an Android VPN client for the public
[VPN Gate](https://www.vpngate.net/) network: thousands of volunteer-run
OpenVPN servers in about 70 countries, published by an academic project at the
University of Tsukuba, Japan.

- One tap, no account, no ads, no analytics SDKs.
- **Automatic** mode times a sample of servers from your own phone, skips the
  ones that don't answer, and connects to the fastest. If a server is busy it
  falls back to the next one.
- DNS goes through the tunnel, and IPv6 is blocked while connected, so neither
  leaks outside the VPN.

ShieldVPN does not run its own servers. Your traffic is carried by volunteer
operators the project does not control, and VPN Gate keeps connection logs, so
ShieldVPN makes no "no-logs" promise. See the
[privacy policy](https://alij93695.github.io/shieldvpn/) for details.

## Building

The app uses Expo SDK 56 (React Native 0.85) and
[ics-openvpn](https://github.com/schwabe/ics-openvpn) through
`@aliakhgar1/react-native-openvpn`. That module needs the config plugin in
`plugins/withOpenVPN.js` and the patch in `patches/` (applied on
`npm install`) to connect.

```bash
npm install
npx expo prebuild --platform android --clean
cd android && ./gradlew bundleRelease
```

Release signing reads a key from outside the repository. See `RELEASE.md`.

## Licence and source

ShieldVPN is free software under the GNU General Public License version 2, with
an additional permission to link against OpenSSL (see `LICENSE`). It includes
ics-openvpn and OpenVPN (GPLv2), OpenVPN 3 Core (MPL-2.0), OpenSSL
(Apache-2.0), LZ4 (BSD-2-Clause) and LZO (GPLv2). See `THIRD_PARTY_LICENSES.md`.

The complete source of the bundled native libraries (ics-openvpn v0.7.60 with
all its submodules) is attached to each
[release](https://github.com/alij93695/shieldvpn/releases). `NATIVE_SOURCES.md`
explains where it comes from.

"OpenVPN" is a registered trademark of OpenVPN Inc. ShieldVPN is not affiliated
with, endorsed by, or sponsored by OpenVPN Inc., the VPN Gate project, or the
University of Tsukuba.

Contact: alij93695@gmail.com

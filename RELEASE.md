# ShieldVPN — release runbook

This app is already on Google Play (package `com.shieldvpn.app`). 1.0.4 /
versionCode 5 was uploaded to Closed testing (Alpha) on 23 Sep 2026 but never
sent for review; it still contained the Expo update check. This release is
**1.0.5 / versionCode 6**, which replaces it in the same Alpha release.

Builds are made **locally** and signed with the app's existing upload key. No
Expo account is needed for that. EAS is documented at the end as an optional
alternative.

---

## Before the first upload — four things only you can do

1. **Confirm the upload key matches Play.** Play Console → Test and release →
   App integrity → App signing → *Upload key certificate* → SHA-256. It must be:

   ```
   B8:44:9E:AA:F8:AF:64:44:D7:60:A5:E4:C4:63:9A:54:53:7F:F9:47:8B:65:CF:D9:F1:75:CA:68:E2:8E:84:2C
   ```

   That is the certificate `CN=ShieldVPN, OU=Development, O=ShieldVPN, L=Dubai,
   ST=Dubai, C=AE` in `my-release-key.keystore`, which signed the older
   project's release builds. If Play shows a different fingerprint, builds 1–4
   were signed by another key (probably one stored in Expo) — do not upload;
   either use that key or request an upload-key reset under App signing.

2. **Publish the source.** *(Done 23 Sep 2026: https://github.com/alij93695/shieldvpn,
   native sources attached to each release.)* The GPL obligation that comes with the bundled
   OpenVPN code is met by an offer of source that points at
   `https://github.com/alij93695/shieldvpn`. That repository must exist and be
   public **before** the release goes out, or the offer is false. If your GitHub
   username or repo name differs, change the URL in `src/lib/licenses.ts`
   (`SOURCE_URL`), `LICENSE`, `THIRD_PARTY_LICENSES.md`, `play_store_listing.txt`
   and `package.json`, then rebuild. Publish the tree this build came from,
   including `plugins/` and `patches/`. `.gitignore` already excludes keystores,
   `keystore.properties`, `.env` files and `play-service-account.json`.

   **The native libraries' source must be published too.** The `.so` files come
   prebuilt from npm with no source, and they are the GPL code that makes this
   obligation exist. Run `bash scripts/package-native-sources.sh` (Git Bash),
   which clones ics-openvpn v0.7.60 with its submodules, checks the commits
   match the shipped binaries, and writes
   `native-sources/ics-openvpn-v0.7.60-with-submodules.tar.gz`. Attach that file
   to the GitHub release for this version. Details in `NATIVE_SOURCES.md`.

3. **Host the privacy policy.** *(Done: https://alij93695.github.io/shieldvpn/,
   set in Play Console.)* In that repo, Settings → Pages → Source: branch
   `main`, folder `/docs`. `docs/index.html` is generated from
   `privacy_policy.txt`. Put the resulting URL (for example
   `https://alij93695.github.io/shieldvpn/`) in the Play Console privacy-policy
   field and in `play_store_listing.txt`.

4. **Check your Play account type** (Play Console → Developer account → About
   you). It is currently **Personal**. Google lists "Apps approved to use the
   VpnService class" among app types that require an Organization account,
   effective 30 September 2026, but scopes that to *creating* an account and is
   silent on existing ones. Ask Play support whether your existing account can
   keep publishing this app, and try to submit before 30 September.
   Sources: https://support.google.com/googleplay/android-developer/answer/17125096 ·
   https://support.google.com/googleplay/android-developer/answer/12564964

---

## Building a signed release locally

Signing reads your key from a `.properties` file **outside the repository**, via
`plugins/withReleaseSigning.js`. No password is ever committed. The file uses
the standard keys; the older checkout's `android/gradle.properties` already
contains them, so it can be pointed at directly:

```
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=...
MYAPP_RELEASE_KEY_PASSWORD=...
```

A relative `STORE_FILE` is resolved against that file's folder, then its `app/`
subfolder. Alternatively, create `keystore.properties` in the project root
(gitignored) with the same keys.

In PowerShell:

```powershell
$env:SHIELDVPN_SIGNING_PROPERTIES = "<path to the older checkout>\shieldvpn-mobile\android\gradle.properties"
npx expo prebuild -p android
cd android
.\gradlew bundleRelease assembleRelease
```

Outputs:

- `android/app/build/outputs/bundle/release/app-release.aab` — upload this to Play
- `android/app/build/outputs/apk/release/app-release.apk` — for installing on a phone

Check before uploading:

- the Gradle log contains `ShieldVPN: signing release builds with my-release-key.keystore`
- `keytool -printcert -jarfile app\build\outputs\bundle\release\app-release.aab`
  (run from the `android` folder the build leaves you in) shows the SHA-256 above

A release build **fails on purpose** when no key is configured, rather than
silently signing with the public debug key that Play rejects.

`npx expo prebuild -p android` must be re-run after **any** change to
`app.json` or `plugins/` — the native project is generated from them. Without
`--clean` it keeps the native build cache (a clean build takes ~45 minutes).

---

## Versioning

Versioning is local (`eas.json` → `cli.appVersionSource: "local"`), set in
`app.json`:

```json
"version": "1.0.5",
"android": { "versionCode": 6 }
```

Every release: increase `android.versionCode` by one (next is **7**), set a
matching `version`, then run prebuild. Play rejects a reused versionCode. A
locally built 1.1.3 / versionCode 14 exists in the older checkout but was never
uploaded, so it does not affect Play.

---

## Play Console — App content

1. **VPN declaration** (Policy → App content): core VPN functionality, not an
   exception category.
2. **Foreground service types**: declare `specialUse`. Reuse the justification in
   `plugins/withOpenVPN.js`. Attach a short screen recording: tap Connect →
   Android's VPN consent dialog → the persistent notification.
3. **Data safety**: "Does your app collect or share any of the required user
   data types?" **No.** From 1.0.5 the app has no update checker, analytics, ads
   or crash reporting, and no backend or accounts. Its only requests of its own
   are the server-list download (GitHub/jsDelivr, fallback vpngate.net) and the
   connection checks against candidate VPN servers. Neither carries an
   identifier, and Play has no IP-address data type unless the IP is used, for
   example to infer location. Traffic the user sends through the VPN goes to the
   volunteer server they chose. The developer never receives it, and the
   in-app disclosure and `privacy_policy.txt` say that operators may log it.
   **If you ever add an SDK that sends data off the device** (expo-updates sends
   a per-install `EAS-Client-ID`, for example), declare it here and in the
   disclosure *before* releasing.
4. **Privacy policy URL** from step 3 above.
5. **App access**: no login. Note that on networks that block VPN services the
   app will report that no server answered.
6. **What's new**: paste the block from `RELEASE_NOTES.md` (487 characters).

The listing copy is in `play_store_listing.txt`. Its title and short description
are within Play's limits, with no promotional words (Play's metadata policy
bans words like "free" in the title) and no "OpenVPN" trademark in the title.

---

## Privacy policy edits

`privacy_policy.txt` is the only copy to edit. Then:

```bash
npm run policy
```

That regenerates `src/lib/privacy-policy.ts` (shown in the app) and
`docs/index.html` (the hosted page). `npm run policy -- --check` fails if they
are out of date.

---

## Over-the-air updates (removed in 1.0.5)

1.0.5 removed `expo-updates`. Each update check sent Expo a persistent
per-install ID, and publishing an update needed an Expo login. Updates now come
only through Play. To bring OTA back, `npx expo install expo-updates`, restore
the `updates` and `runtimeVersion` blocks in `app.json`, check for updates only
after consent, and declare *Device or other IDs* (collected, not shared, App
functionality) in Data safety. Also update the consent screen and
`privacy_policy.txt`, because both currently say the app collects nothing.

---

## Optional: building on EAS instead

Only if you want cloud builds. EAS must sign with the **same** upload key:

```bash
npx eas-cli@latest login --no-browser
npx eas-cli@latest credentials -p android
```

Under the `production` profile, upload `my-release-key.keystore` (alias
`my-key-alias`). Do **not** let EAS generate a new keystore — Play would reject
the upload. Then:

```bash
npx eas-cli@latest build -p android --profile production
```

The project is not a git repository, so the first EAS command asks to run
`git init` (or set `EAS_NO_VCS=1`). `.easignore` excludes `/android` so EAS
regenerates it from `app.json` and `plugins/`. `patch-package` runs on
`postinstall`, which EAS executes.

---

## Known risks and decisions

- **One volunteer's mirror.** The server list comes from
  `github.com/GeorgeXie2333/vpngate-list-mirror` (tooling MIT, data VPN Gate's).
  It is what makes the app work where `vpngate.net` is blocked and what provides
  ~4,500 servers across ~70 countries. If it stops, the app falls back to the
  official API — and on blocking networks, to nothing. Forking it and putting
  your fork first in `MIRROR_HOSTS` (`src/lib/vpngate.ts`) removes that
  dependency and the "someone else controls what my app downloads" exposure.
  Downloaded profiles must already match the exact IP and port the phone
  measured.
- **Relay architecture.** Routing traffic through volunteer servers is the most
  likely rejection reason. The honest listing and consent screen are the
  defence; keep the app free of ads, analytics and paid tiers.
- **VPN Gate's terms** should be checked for any restriction on third-party
  clients.
- **Hermes V1 memory regression** in Expo SDK 56. The fix needs SDK 57, which
  `AGENTS.md` pins against. Not a crash; revisit after this release.
- **Icons.** The launcher icon, adaptive icon and splash are generated from your
  ShieldVPN shield artwork (the older checkout's `icon.png`). A 512×512 Play
  Store icon is in `assets/store/play-icon-512.png` if your listing needs one.
  There is no themed (monochrome) icon; Android 13+ shows the full-colour icon
  instead.
- **Not legal advice.** The GPL/MPL handling is the customary approach, not a
  legal opinion.

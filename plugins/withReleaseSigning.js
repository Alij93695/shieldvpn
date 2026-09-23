/**
 * Release signing for local builds, without putting any secret in the repo.
 *
 * Google Play only accepts uploads signed with the app's existing upload key.
 * This injects a release signingConfig into android/app/build.gradle that reads
 * the key's details from a .properties file OUTSIDE version control:
 *
 *   1. the file named by the SHIELDVPN_SIGNING_PROPERTIES environment variable
 *   2. otherwise <project>/keystore.properties (gitignored and easignored)
 *
 * The file uses the same keys as a standard React Native setup, so an existing
 * android/gradle.properties from an older checkout can be pointed at directly:
 *
 *   MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
 *   MYAPP_RELEASE_KEY_ALIAS=my-key-alias
 *   MYAPP_RELEASE_STORE_PASSWORD=...
 *   MYAPP_RELEASE_KEY_PASSWORD=...
 *
 * A relative STORE_FILE is resolved against the properties file's folder, then
 * its app/ subfolder. A local release build with no key FAILS rather than
 * quietly signing with the public debug key. On EAS Build (EAS_BUILD=true),
 * which injects its own signing, the plugin stays out of the way.
 *
 * Re-running prebuild replaces an earlier injection, so changes to this file
 * take effect without a clean prebuild.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// ShieldVPN release signing — injected by plugins/withReleaseSigning.js';

const LOADER = `${MARKER}
// Reads the key from outside the repository so no secret is ever committed.
def shieldvpnReleaseSigning = { ->
    def envPath = System.getenv("SHIELDVPN_SIGNING_PROPERTIES")
    def propsFile = envPath ? new File(envPath) : new File(rootDir.getParentFile(), "keystore.properties")
    if (!propsFile.isFile()) {
        if (envPath) throw new GradleException("SHIELDVPN_SIGNING_PROPERTIES points at a missing file: " + propsFile)
        // Without a key a release build would silently use the public debug
        // key, which Play rejects and anyone can sign with. Fail loudly instead,
        // except on EAS Build, which injects its own signing afterwards.
        def wantsRelease = gradle.startParameter.taskNames.any { it.toLowerCase().contains("release") }
        // EAS cloud sets EAS_BUILD=true; a local EAS build (eas build --local) sets EAS_BUILD=1.
        def onEas = ["true", "1"].contains(System.getenv("EAS_BUILD"))
        if (wantsRelease && !onEas) {
            throw new GradleException("No release signing key configured. Set SHIELDVPN_SIGNING_PROPERTIES to your key's .properties file, or create keystore.properties in the project root. See RELEASE.md.")
        }
        return null
    }
    def props = new Properties()
    propsFile.withInputStream { props.load(it) }
    def required = ["MYAPP_RELEASE_STORE_FILE", "MYAPP_RELEASE_KEY_ALIAS", "MYAPP_RELEASE_STORE_PASSWORD", "MYAPP_RELEASE_KEY_PASSWORD"]
    def missing = required.findAll { !props.getProperty(it) }
    if (!missing.isEmpty()) throw new GradleException("Signing properties " + propsFile + " is missing: " + missing.join(", "))
    def store = new File(props.getProperty("MYAPP_RELEASE_STORE_FILE"))
    if (!store.isAbsolute()) {
        def candidates = [new File(propsFile.parentFile, store.path), new File(new File(propsFile.parentFile, "app"), store.path)]
        store = candidates.find { it.isFile() } ?: candidates[0]
    }
    if (!store.isFile()) throw new GradleException("Release keystore not found: " + store)
    println "ShieldVPN: signing release builds with " + store.name + " (alias " + props.getProperty("MYAPP_RELEASE_KEY_ALIAS") + ")"
    return [
        storeFile    : store,
        storePassword: props.getProperty("MYAPP_RELEASE_STORE_PASSWORD"),
        keyAlias     : props.getProperty("MYAPP_RELEASE_KEY_ALIAS"),
        keyPassword  : props.getProperty("MYAPP_RELEASE_KEY_PASSWORD"),
    ]
}()

`;

const RELEASE_CONFIG = `        if (shieldvpnReleaseSigning != null) {
            release {
                storeFile shieldvpnReleaseSigning.storeFile
                storePassword shieldvpnReleaseSigning.storePassword
                keyAlias shieldvpnReleaseSigning.keyAlias
                keyPassword shieldvpnReleaseSigning.keyPassword
            }
        }
`;

const RELEASE_SELECTOR =
  'signingConfig shieldvpnReleaseSigning != null ? signingConfigs.release : signingConfigs.debug';

/** Undo a previous injection so the current version can be applied cleanly. */
function removeSigning(gradle) {
  let out = gradle;
  const start = out.indexOf(MARKER);
  if (start >= 0) {
    const endToken = '}()\n';
    const end = out.indexOf(endToken, start);
    if (end < 0) throw new Error('withReleaseSigning: previous injection is malformed');
    out = out.slice(0, start) + out.slice(end + endToken.length).replace(/^\n/, '');
  }
  out = out.split(RELEASE_CONFIG).join('');
  out = out.split(RELEASE_SELECTOR).join('signingConfig signingConfigs.debug');
  return out;
}

function applySigning(original) {
  const gradle = removeSigning(original);

  // 1. The loader must be defined before the android {} block that uses it.
  const androidBlock = gradle.search(/^android\s*\{/m);
  if (androidBlock < 0) throw new Error('withReleaseSigning: android {} block not found');
  let out = gradle.slice(0, androidBlock) + LOADER + gradle.slice(androidBlock);

  // 2. Add a release signingConfig next to the debug one.
  const debugConfig = /(signingConfigs\s*\{\s*\n\s*debug\s*\{[\s\S]*?\n\s*\}\s*\n)/m;
  if (!debugConfig.test(out)) throw new Error('withReleaseSigning: signingConfigs.debug not found');
  out = out.replace(debugConfig, `$1${RELEASE_CONFIG}`);

  // 3. Point the release build type at it, falling back to debug.
  const releaseType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/m;
  if (!releaseType.test(out)) throw new Error('withReleaseSigning: release buildType signingConfig not found');
  out = out.replace(
    releaseType,
    '$1' + RELEASE_SELECTOR
  );

  return out;
}

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withReleaseSigning: expected a Groovy build.gradle');
    }
    cfg.modResults.contents = applySigning(cfg.modResults.contents);
    return cfg;
  });

module.exports.applySigning = applySigning;
module.exports.removeSigning = removeSigning;

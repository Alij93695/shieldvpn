/**
 * Config plugin for @aliakhgar1/react-native-openvpn.
 *
 * The library ships an AndroidManifest whose <application> block is empty, so
 * nothing it needs is ever merged into the app manifest. Without these entries
 * Android refuses to start the tunnel at all:
 *
 *   - OpenVPNService is a VpnService. It must be declared with the
 *     BIND_VPN_SERVICE permission and the android.net.VpnService intent filter,
 *     or startForegroundService() throws and establish() never runs.
 *   - targetSdk 36 means every foreground service needs a foregroundServiceType.
 *     The library already requests FOREGROUND_SERVICE_SPECIAL_USE, so the
 *     service is declared as "specialUse" with the required subtype property.
 *   - OpenVPNStatusService is bound over AIDL by the module's StatusListener.
 *   - DisconnectVPN backs the notification's disconnect action.
 *
 * It also forces legacy (extracted) JNI packaging. ics-openvpn execs
 * libovpnexec.so as a real process out of applicationInfo.nativeLibraryDir, and
 * that path is only a real directory when native libs are extracted.
 */
const {
  withAndroidManifest,
  withGradleProperties,
  AndroidConfig,
} = require('expo/config-plugins');

const FGS_SUBTYPE =
  'This app is a VPN client and runs a foreground service to keep the VPN tunnel alive.';

const REQUIRED_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
];

/** Replace any existing node with the same android:name, then append. */
function upsert(list, node) {
  const name = node.$['android:name'];
  const next = list.filter((entry) => entry?.$?.['android:name'] !== name);
  next.push(node);
  return next;
}

const withOpenVPNManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const application =
      AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    AndroidConfig.Permissions.ensurePermissions(manifest, REQUIRED_PERMISSIONS);

    // ics-openvpn execs libovpnexec.so, which requires extracted native libs.
    application.$['android:extractNativeLibs'] = 'true';

    application.service = upsert(application.service ?? [], {
      $: {
        'android:name': 'de.blinkt.openvpn.core.OpenVPNService',
        'android:permission': 'android.permission.BIND_VPN_SERVICE',
        'android:foregroundServiceType': 'specialUse',
        'android:exported': 'false',
      },
      'intent-filter': [
        { action: [{ $: { 'android:name': 'android.net.VpnService' } }] },
      ],
      property: [
        {
          $: {
            'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
            'android:value': FGS_SUBTYPE,
          },
        },
      ],
    });

    application.service = upsert(application.service, {
      $: {
        'android:name': 'de.blinkt.openvpn.core.OpenVPNStatusService',
        'android:exported': 'false',
      },
    });

    application.activity = upsert(application.activity ?? [], {
      $: {
        'android:name': 'de.blinkt.openvpn.activities.DisconnectVPN',
        'android:exported': 'false',
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        'android:taskAffinity': '.DisconnectVPN',
      },
    });

    application.activity = upsert(application.activity, {
      $: {
        'android:name': 'de.blinkt.openvpn.LaunchVPN',
        'android:exported': 'false',
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        'android:taskAffinity': '.LaunchVPN',
      },
    });

    return cfg;
  });

/** Set a gradle.properties key, replacing any existing value. */
function setGradleProperty(properties, key, value) {
  const next = properties.filter(
    (item) => !(item.type === 'property' && item.key === key)
  );
  next.push({ type: 'property', key, value });
  return next;
}

const withOpenVPNGradleProperties = (config) =>
  withGradleProperties(config, (cfg) => {
    // Extract .so files on install so libovpnexec.so is a real executable file.
    // This feeds packagingOptions.jniLibs.useLegacyPackaging, which AGP applies
    // to the AAB as well, so Play Store installs also get extracted libraries.
    cfg.modResults = setGradleProperty(
      cfg.modResults,
      'expo.useLegacyPackaging',
      'true'
    );

    // The template default (512m metaspace) is not enough once ics-openvpn's
    // ~60 extra Kotlin/Java sources compile alongside Expo, React Native and
    // the four native ABIs — the daemon dies with "Failed to notify build
    // listener > Metaspace" late in the build.
    cfg.modResults = setGradleProperty(
      cfg.modResults,
      'org.gradle.jvmargs',
      '-Xmx6144m -XX:MaxMetaspaceSize=2048m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8'
    );
    return cfg;
  });

module.exports = (config) =>
  withOpenVPNGradleProperties(withOpenVPNManifest(config));

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import * as OpenVPN from '@aliakhgar1/react-native-openvpn';
import {
  AndroidCompatibilityMode,
  ConnectionState,
  TLSSecurityProfile,
} from '@aliakhgar1/react-native-openvpn';

import { LicensesScreen } from '@/components/licenses-screen';
import { PrivacyPolicyModal } from '@/components/privacy-policy-modal';
import {
  type Country,
  type Directory,
  type Server,
  AUTO_COUNTRIES,
  DirectoryUnreachableError,
  ProbeRound,
  ensureConfig,
  fetchDirectory,
  orderByDeviceLatency,
  pickProbePool,
} from '@/lib/vpngate';

/** How many servers to dial before giving up on a region. */
const MAX_ATTEMPTS = 5;
/** How long a single server gets to reach CONNECTED. */
const ATTEMPT_TIMEOUT_MS = 25_000;
/** Re-fetch the directory if the cached copy is older than this. */
const DIRECTORY_TTL_MS = 10 * 60 * 1000;

/** What a slow step resolves to when the user cancelled while it was running. */
const CANCELLED = Symbol('cancelled');

export default function HomeScreen() {
  const [vpnState, setVpnState] = useState<string>(ConnectionState.DISCONNECTED);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState('');

  const [directory, setDirectory] = useState<Directory | null>(null);
  const [directoryAt, setDirectoryAt] = useState(0);
  const [loadingDirectory, setLoadingDirectory] = useState(true);

  // null country code means "Automatic": best server anywhere in the world.
  const [selected, setSelected] = useState<Country | null>(null);
  const [connectedTo, setConnectedTo] = useState<Server | null>(null);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [licensesVisible, setLicensesVisible] = useState(false);
  const [policyVisible, setPolicyVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Lets the native state listener settle the in-flight connection attempt.
  const attemptRef = useRef<{
    settle: (ok: boolean) => void;
    sawConnecting: boolean;
  } | null>(null);
  const cancelledRef = useRef(false);
  // True while handleConnect is running a connect attempt sequence.
  const runningRef = useRef(false);
  // Resolves the current run's cancel signal, so slow awaits end immediately.
  const cancelRunRef = useRef<(() => void) | null>(null);
  const cancelSignalRef = useRef<Promise<typeof CANCELLED> | null>(null);
  // The current run's server probes, so a cancel can abort them.
  const probeRoundRef = useRef<ProbeRound | null>(null);
  // Latest native state, plus anyone waiting for the tunnel to finish tearing
  // down. Without this, the DISCONNECTED event produced by disconnecting a
  // failed attempt can arrive AFTER the next attempt has already reported
  // CONNECTING, and would then settle that healthy attempt as a failure.
  const stateRef = useRef<string>(ConnectionState.DISCONNECTED);
  const disconnectWaitersRef = useRef<(() => void)[]>([]);

  const isConnected = vpnState === ConnectionState.CONNECTED;
  const isConnecting = busy || vpnState === ConnectionState.CONNECTING;

  const [unreachable, setUnreachable] = useState(false);

  // The picker's refresh and the connect-time TTL refresh can fire together;
  // without this the two responses race and the loser's coverage is lost.
  const inFlightRef = useRef<Promise<Directory | null> | null>(null);

  const loadDirectory = useCallback(
    async (): Promise<Directory | null> => {
      if (inFlightRef.current) return inFlightRef.current;

      const run = async (): Promise<Directory | null> => {
        setLoadingDirectory(true);
        try {
          const dir = await fetchDirectory();
          setDirectory(dir);
          setDirectoryAt(Date.now());
          setUnreachable(false);
          return dir;
        } catch (error) {
          if (error instanceof DirectoryUnreachableError) setUnreachable(true);
          return null;
        } finally {
          setLoadingDirectory(false);
        }
      };

      const promise = run();
      inFlightRef.current = promise;
      try {
        return await promise;
      } finally {
        inFlightRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  useEffect(() => {
    if (!isConnecting) {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isConnecting, pulseAnim]);

  useEffect(() => {
    const subscription = OpenVPN.addOpenVPNStateChangeListener((event) => {
      const state = event?.state;
      if (!state) return;
      setVpnState(state);
      stateRef.current = state;

      if (state === ConnectionState.DISCONNECTED) {
        const waiters = disconnectWaitersRef.current;
        disconnectWaitersRef.current = [];
        waiters.forEach((notify) => notify());
      }

      if (
        state === ConnectionState.DISCONNECTED ||
        state === ConnectionState.ERROR ||
        state === ConnectionState.INVALID
      ) {
        setConnectedTo(null);
      }

      // The user tapped Disconnect in the notification. Android reports that as
      // a plain DISCONNECTED, so the native side flags it; without the flag the
      // run would read it as a server failure and dial the next server.
      if ((event as { userInitiated?: boolean }).userInitiated && runningRef.current) {
        cancelledRef.current = true;
        cancelRunRef.current?.();
        probeRoundRef.current?.cancel();
        attemptRef.current?.settle(false);
        return;
      }

      // A tunnel that finishes coming up after the user cancelled — the service
      // was still starting when the cancel arrived — must not be left running.
      if (
        state === ConnectionState.CONNECTED &&
        cancelledRef.current &&
        !attemptRef.current
      ) {
        OpenVPN.disconnect().catch(() => {});
        return;
      }

      const attempt = attemptRef.current;
      if (!attempt) return;

      if (state === ConnectionState.CONNECTING) {
        attempt.sawConnecting = true;
        return;
      }
      if (state === ConnectionState.CONNECTED) {
        attempt.settle(true);
        return;
      }
      // Ignore the DISCONNECTED that merely precedes the tunnel coming up;
      // only a drop after CONNECTING is a real failure.
      const failed =
        state === ConnectionState.ERROR ||
        state === ConnectionState.INVALID ||
        (state === ConnectionState.DISCONNECTED && attempt.sawConnecting);
      if (failed) attempt.settle(false);
    });

    // Sync the UI with a tunnel that was already up when the screen mounted.
    OpenVPN.requestCurrentState().catch(() => {});

    return () => subscription.remove();
  }, []);

  /**
   * Let a slow step end the moment the user cancels. The abandoned work carries
   * on harmlessly in the background: a directory download still refreshes the
   * cache, and a profile download only fills in server.config.
   */
  const untilCancelled = useCallback(
    <T,>(work: Promise<T>): Promise<T | typeof CANCELLED> =>
      cancelSignalRef.current
        ? Promise.race([work, cancelSignalRef.current])
        : work,
    []
  );

  /** Resolves once the tunnel has actually reached DISCONNECTED. */
  const waitForDisconnected = useCallback(
    (timeoutMs = 4000) =>
      new Promise<void>((resolve) => {
        if (stateRef.current === ConnectionState.DISCONNECTED) {
          resolve();
          return;
        }
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(finish, timeoutMs);
        disconnectWaitersRef.current.push(finish);
      }),
    []
  );

  /** Starts one server and resolves once it connects, fails, or times out. */
  const attemptConnect = useCallback(
    (server: Server) =>
      new Promise<boolean>((resolve) => {
        let done = false;
        const settle = (ok: boolean) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          attemptRef.current = null;
          resolve(ok);
        };
        const timer = setTimeout(() => settle(false), ATTEMPT_TIMEOUT_MS);
        attemptRef.current = { settle, sawConnecting: false };

        OpenVPN.connect({
          // The native module rejects empty strings here even though a
          // certificate-based VPNGate profile never uses them.
          address: server.host,
          username: 'vpn',
          password: 'vpn',
          openVPNConfig: server.config ?? '',
          iOSOptions: {
            localizedDescription: 'ShieldVPN',
            networkExtensionBundleIdentifier: 'com.shieldvpn.app.network',
            disconnectOnSleep: false,
            onDemandEnabled: false,
          },
          androidOptions: {
            Notification: {
              openActivityPackageName: 'com.shieldvpn.app.MainActivity',
              titleNotification: 'ShieldVPN',
              titleConnected: '🔒 Secure Connection Active',
              titleConnecting: '🔄 Connecting to VPN...',
              showDisconnectAction: true,
              // Required: the library read this with requireNonNull and
              // crashed the VPN service when it was missing.
              titleDisconnectButton: 'Disconnect',
            },

            // Disconnect from the notification immediately. The confirmation
            // dialog's Reconnect button launched an activity this library
            // does not contain.
            useDisableConfirmDialog: true,

            // Without an explicit resolver the tunnel takes the default route
            // but keeps the old LAN DNS server, which is now unreachable, so
            // every lookup fails and the device looks like it has no internet.
            overrideDNS: true,
            DNS1: '1.1.1.1',
            DNS2: '8.8.8.8',

            // Send all IPv4 through the tunnel and block IPv6, which VPNGate
            // does not carry and which would otherwise leak or stall.
            pullSettings: true,
            useDefaultRoute: true,
            useDefaultRouteV6: false,
            blockUnusedAddressFamilies: true,

            // VPNGate hosts are mostly old OpenVPN 2.4 builds using ciphers
            // that OpenSSL 3 only offers through the legacy provider.
            compatibilityMode: AndroidCompatibilityMode.OpenVPN_2_4_x,
            useLegacyProvider: true,
            tlsProfileSecurity: TLSSecurityProfile.LEGACY,

            // Clamp the tunnel MTU. Many VPNGate hosts silently drop full-size
            // packets, which shows up as "connected but nothing loads".
            useCustomConfig: true,
            customOptions: 'tun-mtu 1400\nmssfix 1360',

            // Never hold the tun device open without a working tunnel, and fail
            // fast so a dead server hands over to the next candidate.
            persistTun: false,
            useReconnectOnNetworkChange: true,
            connectRetry: '2',
            connectRetryMax: '2',
            connectRetryMaxTime: '10',
          },
        }).catch(() => settle(false));
      }),
    []
  );

  const handleConnect = useCallback(async () => {
    // Tapping while servers are being tried aborts the run rather than
    // leaving the user staring at a button that does nothing.
    if (busy) {
      cancelledRef.current = true;
      cancelRunRef.current?.();
      probeRoundRef.current?.cancel();
      setDetail('Cancelling…');
      attemptRef.current?.settle(false);
      await OpenVPN.disconnect().catch(() => {});
      return;
    }

    // Outside a run, a tunnel that is up — or still retrying on its own —
    // means the button is a Stop button.
    if (
      stateRef.current === ConnectionState.CONNECTED ||
      stateRef.current === ConnectionState.CONNECTING
    ) {
      setDetail('');
      await OpenVPN.disconnect().catch(() => {});
      return;
    }

    cancelledRef.current = false;
    cancelSignalRef.current = new Promise<typeof CANCELLED>((resolve) => {
      cancelRunRef.current = () => resolve(CANCELLED);
    });
    runningRef.current = true;
    setBusy(true);
    try {
      if (Platform.OS === 'android') {
        // Android 13+ hides the foreground-service notification without this.
        if (Number(Platform.Version) >= 33) {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          ).catch(() => {});
        }

        if (!(await OpenVPN.isPrepared())) {
          const granted = await OpenVPN.prepare();
          if (!granted) {
            Alert.alert(
              'Permission Denied',
              'VPN permission is required to connect.'
            );
            return;
          }
        }
      }
      if (cancelledRef.current) return;

      let dir = directory;
      if (!dir || Date.now() - directoryAt > DIRECTORY_TTL_MS) {
        setDetail('Finding servers…');
        const loaded = await untilCancelled(loadDirectory());
        if (loaded === CANCELLED) return;
        dir = loaded ?? dir;
      }
      if (cancelledRef.current) return;

      if (!dir || dir.servers.length === 0) {
        Alert.alert(
          'Server List Unavailable',
          'The server list could not be downloaded from GitHub, jsDelivr or vpngate.net. Check that you are online. If you are, this network may be blocking it — try mobile data instead of Wi-Fi (or the reverse).'
        );
        return;
      }

      // Measure from this device: the fastest server for this user is usually
      // a nearby one, and free servers go offline constantly, so this both
      // orders by real latency and skips dead endpoints before spending a 25s
      // dial attempt on each.
      const pool = pickProbePool(dir, selected?.code ?? null);
      setDetail(`Measuring ${pool.length} servers…`);
      const round = new ProbeRound();
      probeRoundRef.current = round;
      const probed = await untilCancelled(
        orderByDeviceLatency(pool, undefined, round)
      );
      if (probed === CANCELLED || cancelledRef.current) return;
      // Never dial servers this device has proved dead.
      const candidates = probed.filter((s) => s.reachability !== 'dead');

      if (candidates.length === 0) {
        Alert.alert(
          'No Servers Reachable',
          pool.length === 0
            ? `No free servers are listed for ${selected?.name ?? 'that region'} right now. Try another region or use Automatic.`
            : `None of the ${pool.length} servers checked ${selected ? `in ${selected.name} ` : ''}answered from your network. Your network may be blocking VPN connections — try mobile data instead of Wi-Fi (or the reverse), or another region.`
        );
        return;
      }

      // Anything left over from an earlier session must be fully down before
      // the first attempt, or its events would be read as this attempt's.
      if (stateRef.current !== ConnectionState.DISCONNECTED) {
        await OpenVPN.disconnect().catch(() => {});
        await waitForDisconnected();
      }

      let dialled = 0;
      for (const server of candidates) {
        if (cancelledRef.current || dialled >= MAX_ATTEMPTS) break;

        // Profiles live in their own files on the mirror, so only the servers
        // actually dialled are ever downloaded.
        setDetail(`Preparing ${server.countryCode} server…`);
        try {
          if ((await untilCancelled(ensureConfig(server))) === CANCELLED) break;
        } catch {
          continue; // Profile unavailable: try the next server, don't count it.
        }
        // The download can take a while; honour a cancel made during it.
        if (cancelledRef.current) break;
        if (!server.config) continue;

        dialled++;
        const rtt = server.deviceMs > 0 ? `${server.deviceMs} ms` : 'latency n/a';
        setDetail(
          `Trying ${server.countryCode} server ${dialled}/${Math.min(MAX_ATTEMPTS, candidates.length)} · ${rtt}`
        );

        if (await attemptConnect(server)) {
          setConnectedTo(server);
          return;
        }
        // Tear the failed attempt down and wait for the tunnel to actually
        // reach DISCONNECTED, so its trailing event cannot land on the next
        // attempt and settle it as a failure.
        await OpenVPN.disconnect().catch(() => {});
        await waitForDisconnected();
      }

      if (cancelledRef.current) return;

      Alert.alert(
        'Connection Failed',
        dialled === 0
          ? 'The server profiles could not be downloaded. Check your connection and try again.'
          : `Tried ${dialled} server${dialled === 1 ? '' : 's'} without success. Free community servers are often overloaded — try again, or pick a different region.`
      );
    } finally {
      // Every exit path — success, failure, cancel — clears the progress text.
      runningRef.current = false;
      probeRoundRef.current?.cancel(); // Nothing from this run outlives it.
      probeRoundRef.current = null;
      cancelRunRef.current = null;
      cancelSignalRef.current = null;
      setDetail('');
      setBusy(false);
    }
  }, [
    busy,
    directory,
    directoryAt,
    loadDirectory,
    selected,
    attemptConnect,
    waitForDisconnected,
    untilCancelled,
  ]);

  const statusLabel = isConnecting
    ? 'Connecting...'
    : isConnected
      ? 'Connected'
      : 'Not Connected';

  const locationLine = selected
    ? `${selected.flag}  ${selected.name}`
    : '🌐  Automatic (Fastest)';

  const locationHint = (() => {
    if (isConnected && connectedTo) {
      const rtt =
        connectedTo.deviceMs > 0 ? `${connectedTo.deviceMs} ms` : 'latency n/a';
      return `${connectedTo.countryName} · ${rtt}`;
    }
    if (loadingDirectory) return 'Loading servers…';
    if (unreachable) return 'Server list unreachable on this network';
    if (!directory) return 'Server list unavailable';
    if (selected) {
      return `${selected.serverCount} server${selected.serverCount === 1 ? '' : 's'}${
        selected.bestSpeedMbps >= 1
          ? ` · up to ${selected.bestSpeedMbps.toFixed(0)} Mbps`
          : ''
      }`;
    }
    return `${directory.servers.length} servers in ${directory.countries.length} countries`;
  })();

  const filteredCountries = (directory?.countries ?? []).filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  });

  const renderCountry = ({ item }: { item: Country }) => (
    <TouchableOpacity
      style={styles.countryItem}
      onPress={() => {
        setSelected(item);
        setPickerVisible(false);
      }}>
      <Text style={styles.countryFlag}>{item.flag}</Text>
      <View style={styles.countryTextBlock}>
        <Text style={styles.countryName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.countryMeta}>
          {item.serverCount} server{item.serverCount === 1 ? '' : 's'}
          {item.bestSpeedMbps >= 1
            ? ` · up to ${item.bestSpeedMbps.toFixed(0)} Mbps`
            : ''}
        </Text>
      </View>
      <SignalBars quality={item.bestQuality} />
      {selected?.code === item.code && <Text style={styles.checkIcon}>✓</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#111" />

      <View style={styles.header}>
        <Text style={styles.title}>
          Shield<Text style={styles.titleAccent}>VPN</Text>
        </Text>
      </View>

      <View style={styles.main}>
        <Animated.View
          style={[
            styles.powerButtonWrapper,
            { transform: [{ scale: pulseAnim }] },
            isConnected && styles.powerButtonWrapperConnected,
            isConnecting && styles.powerButtonWrapperConnecting,
          ]}>
          <TouchableOpacity
            style={[
              styles.powerButton,
              isConnected && styles.powerButtonConnected,
              isConnecting && styles.powerButtonConnecting,
            ]}
            onPress={handleConnect}
            activeOpacity={0.8}>
            <Text style={styles.powerIcon}>⏻</Text>
          </TouchableOpacity>
        </Animated.View>

        <Text
          style={[
            styles.statusText,
            isConnected && { color: '#10B981' },
            isConnecting && { color: '#F59E0B' },
          ]}>
          {statusLabel}
        </Text>
        {detail ? <Text style={styles.detailText}>{detail}</Text> : null}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.locationSelector}
          onPress={() => {
            setSearch('');
            setPickerVisible(true);
          }}
          disabled={isConnecting || isConnected}>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Location</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {locationLine}
            </Text>
            <Text style={styles.locationHint} numberOfLines={1}>
              {locationHint}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <View style={styles.links}>
          <TouchableOpacity onPress={() => setPolicyVisible(true)} hitSlop={8}>
            <Text style={styles.linkText}>Privacy policy</Text>
          </TouchableOpacity>
          <Text style={styles.linkText}>·</Text>
          <TouchableOpacity onPress={() => setLicensesVisible(true)} hitSlop={8}>
            <Text style={styles.linkText}>Open source &amp; source code</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LicensesScreen
        visible={licensesVisible}
        onClose={() => setLicensesVisible(false)}
      />
      <PrivacyPolicyModal
        visible={policyVisible}
        onClose={() => setPolicyVisible(false)}
      />

      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { paddingBottom: insets.bottom + 20 },
            ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Location</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.search}
              placeholder="Search countries"
              placeholderTextColor="#6B7280"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.moreButton}
              disabled={loadingDirectory}
              onPress={() => loadDirectory()}>
              <Text style={styles.moreText}>
                {loadingDirectory
                  ? 'Searching for more regions…'
                  : '↻  Find more regions'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.countryItem, styles.autoItem]}
              onPress={() => {
                setSelected(null);
                setPickerVisible(false);
              }}>
              <Text style={styles.countryFlag}>🌐</Text>
              <View style={styles.countryTextBlock}>
                <Text style={styles.countryName}>Automatic (Fastest)</Text>
                <Text style={styles.countryMeta}>
                  {`Fastest of the top servers across ${Math.min(
                    AUTO_COUNTRIES,
                    directory?.countries.length ?? AUTO_COUNTRIES
                  )} countries, timed from your phone`}
                </Text>
              </View>
              {selected === null && <Text style={styles.checkIcon}>✓</Text>}
            </TouchableOpacity>

            {loadingDirectory && !directory ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color="#9CA3AF" />
                <Text style={styles.countryMeta}>Loading server list…</Text>
              </View>
            ) : (
              <FlatList
                data={filteredCountries}
                keyExtractor={(c) => c.code}
                renderItem={renderCountry}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {directory
                      ? 'No countries match that search.'
                      : 'Server list unavailable. Tap “Find more regions” to retry.'}
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Four-bar signal indicator driven by the 0..1 quality score. */
function SignalBars({ quality }: { quality: number }) {
  const filled = Math.max(1, Math.min(4, Math.round(quality * 4)));
  return (
    <View style={styles.bars}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={[
            styles.bar,
            { height: 4 + i * 3 },
            i <= filled ? styles.barOn : styles.barOff,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  title: { color: 'white', fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  titleAccent: { color: '#EF4444' },
  main: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  powerButtonWrapper: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  powerButtonWrapperConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  powerButtonWrapperConnecting: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  powerButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  powerButtonConnected: { backgroundColor: '#10B981', shadowColor: '#10B981' },
  powerButtonConnecting: { backgroundColor: '#F59E0B', shadowColor: '#F59E0B' },
  powerIcon: { color: 'white', fontSize: 70, fontWeight: 'bold' },
  statusText: {
    marginTop: 30,
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  detailText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  footer: { padding: 30 },
  locationSelector: {
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
  },
  linkText: { color: '#6B7280', fontSize: 12 },
  locationInfo: { flex: 1 },
  locationLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  locationValue: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  locationHint: { color: '#6B7280', fontSize: 12, marginTop: 3 },
  chevron: { color: '#6B7280', fontSize: 30, paddingLeft: 12 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
  },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { color: '#9CA3AF', fontSize: 24 },
  search: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: 'white',
    fontSize: 15,
    marginBottom: 8,
  },
  autoItem: { borderBottomWidth: 1, borderBottomColor: '#374151' },
  moreButton: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#111827',
    marginBottom: 8,
  },
  moreText: { color: '#60A5FA', fontSize: 13, fontWeight: '600' },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2b3544',
  },
  countryFlag: { fontSize: 24, marginRight: 14 },
  countryTextBlock: { flex: 1 },
  countryName: { color: 'white', fontSize: 16 },
  countryMeta: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  checkIcon: {
    color: '#10B981',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 16, gap: 2 },
  bar: { width: 3, borderRadius: 1 },
  barOn: { backgroundColor: '#10B981' },
  barOff: { backgroundColor: '#374151' },
  loadingBlock: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 30,
  },
});

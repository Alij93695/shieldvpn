import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrivacyPolicyModal } from '@/components/privacy-policy-modal';
import { checkForAppUpdateOnce } from '@/lib/app-updates';

/**
 * Prominent disclosure and consent gate.
 *
 * Google Play's VpnService policy requires the disclosure to live inside the
 * app, to appear during normal use rather than behind a menu, to stand apart
 * from any other terms, and to be gated on an affirmative user action. The
 * Android system VPN dialog does not satisfy this, so this screen blocks the
 * app until the user explicitly accepts.
 *
 * Substituting the real text here for something vaguer would defeat the point:
 * ShieldVPN relays traffic through volunteer machines it does not control, and
 * that is exactly the fact a user needs before they tap Connect.
 */

const CONSENT_KEY = 'shieldvpn.disclosure.accepted.v1';

type Props = { children: React.ReactNode };

export function ConsentGate({ children }: Props) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [policyVisible, setPolicyVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem(CONSENT_KEY)
      .then((value) => setAccepted(value === 'true'))
      .catch(() => setAccepted(false));
  }, []);

  // The update check contacts Expo, so it waits for consent like everything else.
  useEffect(() => {
    if (accepted) checkForAppUpdateOnce();
  }, [accepted]);

  const accept = useCallback(() => {
    setAccepted(true);
    AsyncStorage.setItem(CONSENT_KEY, 'true').catch(() => {});
  }, []);

  const decline = useCallback(() => {
    // Declining must not drop the user into a usable VPN screen.
    if (Platform.OS === 'android') BackHandler.exitApp();
  }, []);

  // Render nothing until the stored answer is known, so the disclosure does
  // not flash for users who already accepted it.
  if (accepted === null) return null;

  // children are withheld, not merely covered: mounting the app behind the
  // modal would start its server-list download from the user's real IP before
  // they have agreed to anything, which is exactly the activity the disclosure
  // is supposed to gate.
  if (accepted) return <>{children}</>;

  return (
    <>
      <Modal visible animationType="fade" onRequestClose={decline}>
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              { paddingTop: insets.top + 32 },
            ]}>
            <Text style={styles.title}>Before you connect</Text>

            <Text style={styles.lead}>
              ShieldVPN does not run its own VPN servers.
            </Text>

            <Text style={styles.body}>
              It connects you to <Text style={styles.strong}>VPNGate</Text>, a
              free public network of volunteer-operated servers run by an
              academic project at the University of Tsukuba, Japan.
            </Text>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>What this means</Text>
              <Bullet>
                Your internet traffic is carried by volunteers that ShieldVPN
                does not control, audit, or have any agreement with.
              </Bullet>
              <Bullet>
                The VPNGate project keeps connection logs, including your source
                IP address and connection times, and may hand them to
                authorities where legally required.
              </Bullet>
              <Bullet>
                Individual server operators may independently log or inspect
                traffic passing through their machines.
              </Bullet>
              <Bullet>
                ShieldVPN therefore cannot promise a &ldquo;no-logs&rdquo;
                service, and does not claim to.
              </Bullet>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>What ShieldVPN collects</Text>
              <Bullet>
                Nothing. There is no account, no analytics, no ads, and no
                ShieldVPN server to send anything to. Your chosen region stays
                on this device.
              </Bullet>
              <Bullet>
                What the app does contact, so you hear it from us: a public
                mirror on GitHub for the server list; a sample of candidate VPN
                servers, briefly, to find the fastest one when you tap Connect;
                and Expo&rsquo;s service to check for app updates. Each of
                these sees your IP address. None carries personal information.
              </Bullet>
            </View>

            <Text style={styles.warn}>
              Always use HTTPS. Do not use ShieldVPN for traffic where
              interception by an unknown third party would put you at risk.
            </Text>

            <TouchableOpacity onPress={() => setPolicyVisible(true)}>
              <Text style={styles.link}>Read the full Privacy Policy</Text>
            </TouchableOpacity>
          </ScrollView>

          <View
            style={[styles.actions, { paddingBottom: insets.bottom + 24 }]}>
            <TouchableOpacity style={styles.accept} onPress={accept}>
              <Text style={styles.acceptText}>I understand and agree</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.decline} onPress={decline}>
              <Text style={styles.declineText}>Decline and exit</Text>
            </TouchableOpacity>
          </View>

          <PrivacyPolicyModal
            visible={policyVisible}
            onClose={() => setPolicyVisible(false)}
          />
        </View>
      </Modal>
    </>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  scroll: { padding: 24, paddingTop: 56, gap: 14 },
  title: { color: 'white', fontSize: 26, fontWeight: '800' },
  lead: { color: '#F59E0B', fontSize: 17, fontWeight: '700' },
  body: { color: '#D1D5DB', fontSize: 15, lineHeight: 22 },
  strong: { color: 'white', fontWeight: '700' },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  cardTitle: { color: 'white', fontSize: 15, fontWeight: '700' },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bulletDot: { color: '#6B7280', fontSize: 15, lineHeight: 21 },
  bulletText: { color: '#D1D5DB', fontSize: 14, lineHeight: 21, flex: 1 },
  warn: { color: '#9CA3AF', fontSize: 13, lineHeight: 20, marginTop: 4 },
  link: {
    color: '#60A5FA',
    fontSize: 14,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  actions: {
    padding: 24,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  accept: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptText: { color: 'white', fontSize: 16, fontWeight: '700' },
  decline: { paddingVertical: 12, alignItems: 'center' },
  declineText: { color: '#9CA3AF', fontSize: 14 },
});

import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  PRIVACY_POLICY_CONTACT,
  PRIVACY_POLICY_EFFECTIVE,
  PRIVACY_POLICY_SECTIONS,
} from '@/lib/privacy-policy';

/**
 * Full privacy policy, rendered from text bundled in the app so it works with
 * no network. Used both from the consent screen and from the main screen, so
 * the policy stays reachable after the user has accepted it.
 */
export function PrivacyPolicyModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.title}>Privacy Policy</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + 24 },
          ]}>
          <Text style={styles.meta}>{PRIVACY_POLICY_EFFECTIVE}</Text>
          {PRIVACY_POLICY_SECTIONS.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>
              <Text style={styles.text}>{section.body}</Text>
            </View>
          ))}
          <View style={styles.section}>
            <Text style={styles.heading}>Contact</Text>
            <Text style={styles.text}>{PRIVACY_POLICY_CONTACT}</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  title: { color: 'white', fontSize: 22, fontWeight: '800' },
  close: { color: '#9CA3AF', fontSize: 24 },
  body: { paddingHorizontal: 24, gap: 18 },
  meta: { color: '#6B7280', fontSize: 12 },
  section: { gap: 6 },
  heading: { color: 'white', fontSize: 15, fontWeight: '700' },
  text: { color: '#D1D5DB', fontSize: 14, lineHeight: 21 },
});

import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LICENSE_TEXTS } from '@/lib/license-texts';
import {
  APP_LICENSE,
  SOURCE_URL,
  THIRD_PARTY_LICENSES,
} from '@/lib/licenses';

/**
 * Open-source licences and the GPL's written offer of source.
 *
 * Reachable from the main screen rather than only at first run, because the
 * GPL's notice obligations apply to everyone who received the binary, whenever
 * they look for it.
 */
export function LicensesScreen({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [openText, setOpenText] = useState<string | null>(null);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
          <Text style={styles.title}>Open Source Licences</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + 24 },
          ]}>
          <View style={styles.appCard}>
            <Text style={styles.appTitle}>{APP_LICENSE.title}</Text>
            <Text style={styles.appBody}>{APP_LICENSE.body}</Text>
            <TouchableOpacity
              style={styles.copyButton}
              onPress={() =>
                Clipboard.setStringAsync(SOURCE_URL).catch(() => {})
              }>
              <Text style={styles.copyText}>Copy source code link</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Included software</Text>

          {THIRD_PARTY_LICENSES.map((entry) => (
            <View key={entry.name} style={styles.card}>
              <Text style={styles.name}>{entry.name}</Text>
              <Text style={styles.copyright}>{entry.copyright}</Text>
              <Text style={styles.license}>{entry.license}</Text>
              {entry.note ? (
                <Text style={styles.note}>{entry.note}</Text>
              ) : null}
              <Text style={styles.url}>{entry.url}</Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Full licence texts</Text>
          {LICENSE_TEXTS.map((entry) => {
            const open = openText === entry.title;
            return (
              <View key={entry.title} style={styles.card}>
                <TouchableOpacity
                  onPress={() => setOpenText(open ? null : entry.title)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}>
                  <Text style={styles.name}>
                    {open ? '▾ ' : '▸ '}
                    {entry.title}
                  </Text>
                  <Text style={styles.copyright}>
                    Applies to: {entry.appliesTo}
                  </Text>
                </TouchableOpacity>
                {open ? (
                  <Text style={styles.licenseText} selectable>
                    {entry.text}
                  </Text>
                ) : null}
              </View>
            );
          })}
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
    paddingTop: 56,
    paddingBottom: 12,
  },
  title: { color: 'white', fontSize: 22, fontWeight: '800' },
  close: { color: '#9CA3AF', fontSize: 24 },
  body: { padding: 24, paddingTop: 0, gap: 14 },
  appCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  appTitle: { color: 'white', fontSize: 17, fontWeight: '700' },
  appBody: { color: '#D1D5DB', fontSize: 13, lineHeight: 20 },
  copyButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 2,
  },
  copyText: { color: '#60A5FA', fontSize: 13, fontWeight: '600' },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#1F2937',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  name: { color: 'white', fontSize: 15, fontWeight: '700' },
  copyright: { color: '#9CA3AF', fontSize: 12, lineHeight: 18 },
  license: { color: '#D1D5DB', fontSize: 13, lineHeight: 19 },
  note: { color: '#6B7280', fontSize: 12, lineHeight: 18, marginTop: 2 },
  url: { color: '#60A5FA', fontSize: 12, marginTop: 2 },
  licenseText: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
    marginTop: 10,
  },
});

import { Stack } from 'expo-router';

import { ConsentGate } from '@/components/consent-gate';

export default function RootLayout() {
  return (
    <ConsentGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#111' },
        }}
      />
    </ConsentGate>
  );
}

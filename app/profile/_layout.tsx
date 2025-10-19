// app/profile/_layout.tsx
import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: 'PAZ',
        headerTintColor: '#F3F4F6',
        headerStyle: { backgroundColor: '#121219' },
        headerShadowVisible: Platform.OS === 'ios',
      }}
    />
  );
}

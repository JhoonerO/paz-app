import { Stack } from 'expo-router';
import { useSegments } from 'expo-router';

export default function ProfileLayout() {
  const segments = useSegments();
  const isSettings = segments.includes('settings');

  return (
    <Stack
      screenOptions={{
        headerShown: !isSettings, // oculta el header solo en settings
      }}
    />
  );
}

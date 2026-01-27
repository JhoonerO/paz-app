// app/search/_layout.tsx
import { Stack } from 'expo-router';

export default function SearchLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}

// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        animationTypeForReplace: 'push',
      }}
    >
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="register" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="reset-password" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="verify-code" options={{ animation: 'fade' }} />
    </Stack>
  );
}

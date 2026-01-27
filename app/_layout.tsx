//app/_layout.tsx
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

SplashScreen.preventAutoHideAsync();

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0B0B0F',
    card: '#121219',
    border: '#121219',
    text: '#F3F4F6',
    primary: '#4F46E5',
  },
};

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;

      if (url.includes('auth/callback')) {
        const parsed = Linking.parse(url);
        const params = parsed.queryParams || {};

        if (params.type === 'recovery' && params.access_token) {
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token as string,
            refresh_token: params.refresh_token as string,
          });

          if (!error) {
            router.replace('/(auth)/reset-password-direct');
          }
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (!url) return;
      void handleDeepLink({ url });
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={AppTheme}>
      <StatusBar style="light" backgroundColor="#0B0B0F" />

      <Stack
        screenOptions={{
          headerShown: false,
          animationTypeForReplace: 'push',
          animation: 'fade',
          contentStyle: { backgroundColor: '#0B0B0F' },
        }}
      >
        {/* Flujos principales */}
        <Stack.Screen name="(auth)" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'default' }} />

        {/* Pantallas top-level reales */}
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />

        {/* Carpetas con rutas internas (ej: story/[id], profile/[id], profile/settings) */}
        <Stack.Screen name="story" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}

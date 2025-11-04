import { Slot, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

// No ocultar el splash automáticamente → lo haremos cuando todo cargue
SplashScreen.preventAutoHideAsync();

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    // Colores según tu mock
    background: '#0B0B0F', // fondo principal
    card: '#121219',       // barras/cards
    border: '#121219',
    text: '#F3F4F6',
    primary: '#4F46E5',    // acento
  },
};

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({});

  // 👇 NUEVO: Listener de Deep Links para magic link
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('🔗 Deep link recibido:', url);

      if (url.includes('auth/callback')) {
        const parsed = Linking.parse(url);
        const params = parsed.queryParams || {};
        
        console.log('📦 Parámetros del link:', params);

        if (params.type === 'recovery' && params.access_token) {
          // Establecer sesión de Supabase
          const { error } = await supabase.auth.setSession({
            access_token: params.access_token as string,
            refresh_token: params.refresh_token as string,
          });

          if (!error) {
            console.log('✅ Sesión establecida correctamente');
            router.replace('/(auth)/reset-password-direct');
          } else {
            console.error('❌ Error al establecer sesión:', error);
          }
        }
      }
    };

    // Listener para cuando la app ya está abierta
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Verificar si la app se abrió con un link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 👇 TU LÓGICA ORIGINAL DE SPLASH SCREEN (sin cambios)
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={AppTheme}>
      <StatusBar style="light" backgroundColor="#0B0B0F" />
      <Slot />
    </ThemeProvider>
  );
}

//app/_layout.tsx
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '../lib/supabase';
import { useVersionCheck } from '../hooks/useVersionCheck';

SplashScreen.preventAutoHideAsync();

const { width, height } = Dimensions.get('window');

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

function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;

  const handleLoad = () => {
    Animated.sequence([
      Animated.delay(1600),
      Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start(() => onDone());
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity, backgroundColor: '#0B0B0F' }]}>
      <Image
        source={require('../assets/SplashNuevo.png')}
        style={{ width, height }}
        contentFit="cover"
        transition={400}
        onLoad={handleLoad}
      />
    </Animated.View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({});
  const [showSplash, setShowSplash] = useState(true);
  const { showUpdate, forceUpdate, openPlayStore, dismiss } = useVersionCheck();

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
            router.replace('/(auth)/reset-password');
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
        <Stack.Screen name="(auth)" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'default' }} />
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="story" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
      </Stack>

      {showSplash && (
        <AnimatedSplash onDone={() => setShowSplash(false)} />
      )}

      <Modal visible={showUpdate} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={up.overlay}>
          <View style={up.sheet}>
            <Text style={up.emoji}>🚀</Text>
            <Text style={up.title}>Nueva versión disponible</Text>
            <Text style={up.body}>
              Hay una actualización de U-PAZ lista. Actualiza para tener lo último y lo mejor.
            </Text>
            <TouchableOpacity style={up.btn} onPress={openPlayStore}>
              <Text style={up.btnTxt}>Actualizar ahora</Text>
            </TouchableOpacity>
            {!forceUpdate && (
              <TouchableOpacity onPress={dismiss} hitSlop={10}>
                <Text style={up.skip}>Ahora no</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </ThemeProvider>
  );
}

const up = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  sheet: {
    backgroundColor: '#0D0D14',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4F46E5',
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  emoji: { fontSize: 40, marginBottom: 12 },
  title: {
    color: '#F3F4F6',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  body: {
    color: '#9CA3AF',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 24,
  },
  btn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  skip: { color: '#4B5563', fontSize: 13 },
});

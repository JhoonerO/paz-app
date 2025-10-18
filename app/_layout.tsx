import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';

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
  // Más adelante cargaremos tu tipografía; por ahora sin fuentes personalizadas
  const [fontsLoaded] = useFonts({});

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync(); // ahora sí ocultamos el splash
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null; // evita render parcial → cero parpadeo

  return (
    <ThemeProvider value={AppTheme}>
      <StatusBar style="light" backgroundColor="#0B0B0F" />
      <Slot />
    </ThemeProvider>
  );
}

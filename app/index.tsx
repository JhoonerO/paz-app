// app/index.tsx
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_SESSION = 'session_active';

export default function Index() {
  const [ready, setReady] = useState(false);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem(KEY_SESSION);
        setLogged(!!s);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0B0F', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // Si hay sesión -> abre tabs; si no -> login
  return <Redirect href={logged ? '/(tabs)' : '/(auth)/login'} />;
}

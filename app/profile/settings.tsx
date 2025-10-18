import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const KEY_SHOW_LIKES = 'pref_showLikes';
const KEY_SESSION = 'session_active';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showLikes, setShowLikes] = useState(true);

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem(KEY_SHOW_LIKES);
      setShowLikes(v === null ? true : v === 'true');
    })();
  }, []);

  async function toggleLikes(v: boolean) {
    setShowLikes(v);
    await AsyncStorage.setItem(KEY_SHOW_LIKES, String(v));
  }

  async function logout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(KEY_SESSION);
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const HEADER_H = 56;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }} edges={['top', 'bottom']}>
      {/* Header: al salir, SIEMPRE ir al perfil */}
      <View style={[s.header, { paddingTop: insets.top, height: insets.top + HEADER_H }]}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/profile')}
          style={s.headerBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={22} color="#F3F4F6" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Configuración de la Cuenta</Text>
        <View style={s.headerBtn} />
      </View>

      {/* Contenido */}
      <View style={s.content}>
        <Row>
          <Ionicons name="notifications-outline" size={18} color="#E5E7EB" />
          <Text style={s.rowText}>Notificaciones</Text>
          <Text style={s.badgeMuted}>Próximamente</Text>
        </Row>

        <Row>
          <Ionicons name="heart-outline" size={18} color="#E5E7EB" />
          <Text style={s.rowText}>Dejar ver tus Likes?</Text>
          <View style={{ flex: 1 }} />
          <Switch
            value={showLikes}
            onValueChange={toggleLikes}
            thumbColor={showLikes ? '#60A5FA' : '#374151'}
            trackColor={{ true: '#1F3B5B', false: '#111827' }}
          />
        </Row>

        <Row>
          <Ionicons name="book-outline" size={18} color="#E5E7EB" />
          <Text style={s.rowText}>Editar Historias Subidas (beta)</Text>
          <Text style={s.badgeMuted}>Próximamente</Text>
        </Row>

        <TouchableOpacity style={s.logout} onPress={logout} activeOpacity={0.9}>
          <Text style={s.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={s.row}>{children}</View>;
}

const s = StyleSheet.create({
  header: {
    backgroundColor: '#121219',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F27',
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#F3F4F6', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },

  content: { padding: 16, gap: 10 },
  row: {
    backgroundColor: '#121219',
    borderWidth: 1,
    borderColor: '#1F1F27',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: { color: '#E5E7EB', fontSize: 15, flexShrink: 1 },
  badgeMuted: { marginLeft: 'auto', color: '#9CA3AF', fontSize: 12 },

  logout: { marginTop: 14, paddingVertical: 16, alignItems: 'center' },
  logoutText: { color: '#EF4444', fontWeight: '600' },
});

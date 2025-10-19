// app/profile/settings.tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

const KEY_SESSION = 'session_active';           // tu clave existente
const KEY_SHOW_LIKES_CACHE = 'pref_showLikes';  // cache opcional local

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // likes_public en Supabase
  const [showLikes, setShowLikes] = useState(true);
  const [savingLikes, setSavingLikes] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // modal de cerrar sesión
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ---------- Carga inicial desde Supabase ----------
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setUserId(uid);

      // usa cache como fallback mientras llega Supabase (evita parpadeo)
      const cached = await AsyncStorage.getItem(KEY_SHOW_LIKES_CACHE);
      if (cached !== null) setShowLikes(cached === 'true');

      if (!uid) return;

      const { data: prof, error } = await supabase
        .from('profiles')
        .select('likes_public')
        .eq('id', uid)
        .single<{ likes_public: boolean }>();

      if (!error && prof) {
        setShowLikes(Boolean(prof.likes_public));
        await AsyncStorage.setItem(KEY_SHOW_LIKES_CACHE, String(prof.likes_public));
      }
    })();
  }, []);

  // ---------- Update en Supabase con optimismo + rollback ----------
  async function toggleLikes(next: boolean) {
    if (!userId || savingLikes) return;
    setSavingLikes(true);

    // Optimista
    const prev = showLikes;
    setShowLikes(next);
    await AsyncStorage.setItem(KEY_SHOW_LIKES_CACHE, String(next));

    const { error } = await supabase
      .from('profiles')
      .update({ likes_public: next })
      .eq('id', userId);

    if (error) {
      // rollback si falla
      setShowLikes(prev);
      await AsyncStorage.setItem(KEY_SHOW_LIKES_CACHE, String(prev));
      console.warn('No se pudo actualizar likes_public:', error.message);
    }
    setSavingLikes(false);
  }

  // ---------- Logout ----------
  function logout() {
    setConfirmOpen(true);
  }

  async function doLogout() {
    try {
      setLoggingOut(true);
      await AsyncStorage.removeItem(KEY_SESSION);
      setConfirmOpen(false);
      router.replace('/(auth)/login');
    } finally {
      setLoggingOut(false);
    }
  }

  const HEADER_H = 56;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }} edges={['top', 'bottom']}>
      {/* Header */}
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
            disabled={savingLikes || !userId}
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

      {/* Modal Cerrar sesión */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={s.modalBackdrop}>
          <Pressable style={s.backdropTouchable} onPress={() => !loggingOut && setConfirmOpen(false)} />
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <Ionicons name="log-out-outline" size={22} color="#FEE2E2" />
            </View>
            <Text style={s.modalTitle}>Cerrar sesión</Text>
            <Text style={s.modalMsg}>¿Seguro que quieres salir?</Text>

            <View style={s.modalBtns}>
              <TouchableOpacity
                onPress={() => setConfirmOpen(false)}
                style={[s.modalBtn, s.btnGhost]}
                disabled={loggingOut}
                activeOpacity={0.85}
              >
                <Text style={[s.modalBtnTxt, s.btnGhostTxt]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={doLogout}
                style={[s.modalBtn, s.btnDanger]}
                disabled={loggingOut}
                activeOpacity={0.85}
              >
                <Text style={s.modalBtnTxt}>{loggingOut ? 'Saliendo…' : 'Salir'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  backdropTouchable: { flex: 1 },
  modalCard: {
    backgroundColor: '#121219',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: '#1F1F27',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  modalIconWrap: {
    alignSelf: 'center',
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#451a1a', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  modalTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  modalMsg: { color: '#C9C9D1', textAlign: 'center', marginTop: 4, marginBottom: 12 },
  modalBtns: { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  modalBtn: { flex: 1, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1F2937' },
  btnGhostTxt: { color: '#E5E7EB' },
  btnDanger: { backgroundColor: '#991b1b' },
  modalBtnTxt: { color: '#F3F4F6', fontWeight: '700' },
});

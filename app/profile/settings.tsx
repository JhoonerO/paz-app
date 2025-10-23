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
import { useFonts, Risque_400Regular } from '@expo-google-fonts/risque'; // 👈 Importa la fuente

const KEY_SESSION = 'session_active';
const KEY_SHOW_LIKES_CACHE = 'pref_showLikes';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Carga de la fuente
  const [fontsLoaded] = useFonts({
    Risque_400Regular,
  });

  const [showLikes, setShowLikes] = useState(true);
  const [savingLikes, setSavingLikes] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      setUserId(uid);

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

  async function toggleLikes(next: boolean) {
    if (!userId || savingLikes) return;
    setSavingLikes(true);

    const prev = showLikes;
    setShowLikes(next);
    await AsyncStorage.setItem(KEY_SHOW_LIKES_CACHE, String(next));

    const { error } = await supabase
      .from('profiles')
      .update({ likes_public: next })
      .eq('id', userId);

    if (error) {
      setShowLikes(prev);
      await AsyncStorage.setItem(KEY_SHOW_LIKES_CACHE, String(prev));
      console.warn('No se pudo actualizar likes_public:', error.message);
    }
    setSavingLikes(false);
  }

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

  // Si las fuentes no están cargadas, muestra un loader o nada
  if (!fontsLoaded) {
    return (
      <View style={s.screen}>
        <Text style={{ color: '#F3F4F6', textAlign: 'center', marginTop: 50 }}>
          Cargando...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.screen, { paddingTop: insets.top + 56 }]} edges={['top', 'bottom']}>
      {/* Header — ahora es el único y tiene el título correcto */}
      <View style={[s.header, { position: 'absolute', top: insets.top, left: 0, right: 0 }]}>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)/profile')}
          style={s.headerBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>
        <Text
      style={{
        fontFamily: 'Risque_400Regular',
        fontSize: 22,
        color: '#F3F4F6',
        letterSpacing: 1,
        flex: 1, 
        textAlign: 'center',
      }}
    >
      Configuracion U-Paz
    </Text>
        <View style={s.headerBtn} />
      </View>

      {/* Contenido */}
      <View style={s.content}>
        <SettingRow icon="notifications-outline" label="Notificaciones">
          <Text style={s.comingSoon}>Próximamente</Text>
        </SettingRow>

        <SettingRow icon="heart-outline" label="Dejar ver tus Likes?">
          <Switch
            value={showLikes}
            onValueChange={toggleLikes}
            disabled={savingLikes || !userId}
            thumbColor={showLikes ? '#EF4444' : '#374151'}
            trackColor={{ true: '#3B1111', false: '#111827' }}
          />
        </SettingRow>

        <SettingRow icon="book-outline" label="Editar Historias Subidas (beta)">
          <Text style={s.comingSoon}>Próximamente</Text>
        </SettingRow>

        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.85}>
          <Text style={s.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Modal — estilo igual al sheet de profile.tsx */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !loggingOut && setConfirmOpen(false)}
      >
        <View style={s.overlay}>
          <Pressable style={s.backdrop} onPress={() => !loggingOut && setConfirmOpen(false)} />
          <View style={s.sheet}>
            <View style={s.iconWrap}>
              <Ionicons name="log-out-outline" size={24} color="#F87171" />
            </View>
            <Text style={s.sheetTitle}>Cerrar sesión</Text>
            <Text style={s.sheetMsg}>¿Seguro que quieres salir?</Text>

            <View style={s.sheetActions}>
              <TouchableOpacity
                style={[s.sheetBtn, s.sheetBtnSecondary]}
                onPress={() => setConfirmOpen(false)}
                disabled={loggingOut}
              >
                <Text style={s.sheetBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.sheetBtn, s.sheetBtnPrimary]}
                onPress={doLogout}
                disabled={loggingOut}
              >
                <Text style={s.sheetBtnText}>{loggingOut ? 'Saliendo…' : 'Salir'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.row}>
      <Ionicons name={icon as any} size={18} color="#E5E7EB" />
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowAction}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000ff',
  },

  // === Header ===
  header: {
    backgroundColor: '#000000ff',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#181818ff',
    zIndex: 1000, // 👈 Para que esté encima de todo
  },
  headerBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F3F4F6',
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Risque_400Regular', // ✅ Fuente aplicada
    flex: 1,
    textAlign: 'center',
  },

  // === Contenido ===
  content: {
    padding: 16,
    gap: 12,
    marginTop: -20, // 👈 Espacio para que no se solape con el header
  },
  row: {
    backgroundColor: '#010102ff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#181818ff',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLabel: {
    color: '#F3F4F6',
    fontSize: 16,
    flex: 1,
    flexShrink: 1,
  },
  rowAction: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
  comingSoon: {
    color: '#9CA3AF',
    fontSize: 13,
  },

  logoutBtn: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },

  // === Modal / Sheet ===
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#010102ff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#181818ff',
  },

   //const C = {/*
  //bg: '#000000ff',
  //card: '#010102ff',
  //cardBorder: '#181818ff',
  //textPrimary: '#F3F4F6',
  //textSecondary: '#A1A1AA',
  //line: '#000000ff',
  //avatarBg: '#0F1016',
  //avatarBorder: '#2C2C33',
  //like: '#ef4444',};

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3F1D1D',
    borderColor: '#7F1D1D',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    color: '#F3F4F6',
    fontWeight: '700',
    fontSize: 18,
    textAlign: 'center',
  },
  sheetMsg: {
    color: '#D1D5DB',
    textAlign: 'center',
    marginTop: 6,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  sheetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sheetBtnPrimary: {
    backgroundColor: '#1f1f1fff',
    borderColor: '#27272A',
  },
  sheetBtnSecondary: {
    backgroundColor: 'transparent',
    borderColor: '#27272A',
  },
  sheetBtnText: {
    fontWeight: '600',
    color: '#fff',
  },
});
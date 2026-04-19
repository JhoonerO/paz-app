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
  FlatList,
  Image,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useFonts, Risque_400Regular } from '@expo-google-fonts/risque';

const KEY_SESSION = 'session_active';
const KEY_SHOW_LIKES_CACHE = 'pref_showLikes';

type Story = {
  id: string;
  title: string;
  cover_url: string | null;
  body: string;
  category: string;
  author_name: string | null;
};

// ── Tipos insignia ────────────────────────────────────────────────────────────
type Badge = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string | null;
  scope?: 'admin_only' | 'all_users' | 'custom';
};

type IconSet = 'MaterialCommunityIcons' | 'MaterialIcons';

const BADGE_COLORS = [
  '#F3F4F6', '#FFD700', '#06B6D4', '#6EE7B7',
  '#8B9DC3', '#9CA3AF', '#B8A9C9', '#A0B4B8',
  '#34D399', '#60A5FA', '#E879F9', '#F472B6',
  '#FB923C', '#F97316', '#EF4444', '#F87171',
  '#A78BFA', '#818CF8', '#38BDF8', '#2DD4BF',
  '#FACC15', '#FBBF24', '#C084FC', '#D946EF',
  '#22D3EE', '#4ADE80', '#F43F5E', '#8B5CF6',
];

// ── Íconos — ahora incluye verified de MaterialIcons ─────────────────────────
const BADGE_ICONS: { name: string; label: string; set: IconSet }[] = [
  { name: 'verified',          label: 'Verificado', set: 'MaterialIcons'             },
  { name: 'star',              label: 'Estrella',   set: 'MaterialIcons'             },
  { name: 'favorite',          label: 'Favorito',   set: 'MaterialIcons'             },
  { name: 'workspace-premium', label: 'Premium',    set: 'MaterialIcons'             },
  { name: 'military-tech',     label: 'Mérito',     set: 'MaterialIcons'             },
  { name: 'emoji-events',      label: 'Trofeo',     set: 'MaterialIcons'             },
  { name: 'mood',              label: 'Feliz',      set: 'MaterialIcons'             },
  { name: 'local-fire-department', label: 'Fuego',  set: 'MaterialIcons'             },
  { name: 'diamond',           label: 'Diamante',   set: 'MaterialIcons'             },
  { name: 'rocket-launch',     label: 'Cohete',     set: 'MaterialIcons'             },
  { name: 'shield',            label: 'Escudo',     set: 'MaterialIcons'             },
  { name: 'shield-moon',       label: 'Nocturno',   set: 'MaterialIcons'             },
  { name: 'crown',             label: 'Corona',     set: 'MaterialCommunityIcons'    },
  { name: 'shield-star',       label: 'Escudo ★',   set: 'MaterialCommunityIcons'    },
  { name: 'star-shooting',     label: 'Estrella F', set: 'MaterialCommunityIcons'    },
  { name: 'trophy',            label: 'Copa',       set: 'MaterialCommunityIcons'    },
  { name: 'fire',              label: 'Llama',      set: 'MaterialCommunityIcons'    },
  { name: 'heart-multiple',    label: 'Corazón',    set: 'MaterialCommunityIcons'    },
  { name: 'lightning-bolt',    label: 'Rayo',       set: 'MaterialCommunityIcons'    },
  { name: 'book-open-variant', label: 'Libro',      set: 'MaterialCommunityIcons'    },
  { name: 'feather',           label: 'Pluma',      set: 'MaterialCommunityIcons'    },
  { name: 'compass-rose',      label: 'Brújula',    set: 'MaterialCommunityIcons'    },
  { name: 'moon-waning-crescent', label: 'Luna',    set: 'MaterialCommunityIcons'    },
  { name: 'snowflake',         label: 'Cristal',    set: 'MaterialCommunityIcons'    },
  { name: 'flower-tulip',      label: 'Flor',       set: 'MaterialCommunityIcons'    },
  { name: 'skull-outline',     label: 'Calavera',   set: 'MaterialCommunityIcons'    },
  { name: 'ghost',             label: 'Fantasma',   set: 'MaterialCommunityIcons'    },
  { name: 'dragon-variant',    label: 'Dragón',     set: 'MaterialCommunityIcons'    },
  { name: 'sword',             label: 'Espada',     set: 'MaterialCommunityIcons'    },
  { name: 'axe',               label: 'Hacha',      set: 'MaterialCommunityIcons'    },
  { name: 'paw',               label: 'Huella',     set: 'MaterialCommunityIcons'    },
  { name: 'paw-off',           label: 'Lobo',       set: 'MaterialCommunityIcons'    },
  { name: 'music-clef-treble', label: 'Música',     set: 'MaterialCommunityIcons'    },
  { name: 'movie-roll',        label: 'Cine',       set: 'MaterialCommunityIcons'    },
  { name: 'palette',           label: 'Arte',       set: 'MaterialCommunityIcons'    },
  { name: 'microphone-variant',label: 'Voz',        set: 'MaterialCommunityIcons'    },
  { name: 'gamepad-variant',   label: 'Gamer',      set: 'MaterialCommunityIcons'    },
  { name: 'brain',             label: 'Genio',      set: 'MaterialCommunityIcons'    },
  { name: 'eye',               label: 'Ojo',        set: 'MaterialCommunityIcons'    },
  { name: 'infinity',          label: 'Infinito',   set: 'MaterialCommunityIcons'    },
  { name: 'atom',              label: 'Átomo',      set: 'MaterialCommunityIcons'    },
  { name: 'earth',             label: 'Planeta',    set: 'MaterialCommunityIcons'    },
  { name: 'alien',             label: 'Alien',      set: 'MaterialCommunityIcons'    },
  { name: 'robot',             label: 'Robot',      set: 'MaterialCommunityIcons'    },
  { name: 'skull-scan',        label: 'Scanner',    set: 'MaterialCommunityIcons'    },
];

// Usamos el índice para diferenciar los dos "verified"
// Guardamos en DB: "verified_MI" para MaterialIcons, el resto sin prefijo
const ICON_STORAGE_KEY: Record<string, { name: string; set: IconSet }> = {};
BADGE_ICONS.forEach((ic, i) => {
  const key = ic.set === 'MaterialIcons' ? `${ic.name}_MI_${i}` : ic.name;
  ICON_STORAGE_KEY[key] = { name: ic.name, set: ic.set };
});

// Helper: renderiza el ícono correcto según el set guardado en DB
export function BadgeIcon({
  iconKey,
  size,
  color,
}: {
  iconKey: string;
  size: number;
  color: string;
}) {
  // Si termina en _MI_N es MaterialIcons
  if (iconKey?.includes('_MI_')) {
    const name = iconKey.split('_MI_')[0];
    return <MaterialIcons name={name as any} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={iconKey as any} size={size} color={color} />;
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({ Risque_400Regular });

  const [showLikes, setShowLikes] = useState(true);
  const [savingLikes, setSavingLikes] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [restrictUnipaz, setRestrictUnipaz] = useState(true);
  const [savingRestrict, setSavingRestrict] = useState(false);

  const [stories, setStories] = useState<Story[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCategory, setEditCategory] = useState('Urbana');
  const [savingEdit, setSavingEdit] = useState(false);
  const [loadingStories, setLoadingStories] = useState(false);

  // ── Estado modal crear insignia ───────────────────────────────────────────
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [badgeName, setBadgeName] = useState('');
  const [badgeDesc, setBadgeDesc] = useState('');
  const [badgeColor, setBadgeColor] = useState('#FFD700');
  const [badgeIconKey, setBadgeIconKey] = useState('verified_MI_0'); // default: check verificado
  const [badgeScope, setBadgeScope] = useState<'admin_only' | 'all_users' | 'custom'>('custom');
  const [savingBadge, setSavingBadge] = useState(false);

  // ── Estado insignias existentes ───────────────────────────────────────────
  const [existingBadges, setExistingBadges] = useState<Badge[]>([]);
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [showBadgeInfoModal, setShowBadgeInfoModal] = useState(false);
  const [editingBadge, setEditingBadge] = useState(false);
  const [deleteBadgeConfirm, setDeleteBadgeConfirm] = useState(false);

  const [showSheet, setShowSheet] = useState(false);
  const [sheet, setSheet] = useState<{
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    variant: 'info' | 'error' | 'success';
  }>({
    title: '',
    message: '',
    confirmText: 'Cerrar',
    onConfirm: () => setShowSheet(false),
    variant: 'info',
  });

  function showNotification(
    title: string,
    message: string,
    variant: 'info' | 'error' | 'success' = 'info',
    confirmText = 'Cerrar',
    onConfirm?: () => void
  ) {
    setSheet({
      title, message, confirmText, variant,
      onConfirm: onConfirm || (() => setShowSheet(false)),
    });
    setShowSheet(true);
  }

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
        .select('likes_public, is_admin')
        .eq('id', uid)
        .single<{ likes_public: boolean; is_admin: boolean }>();

      if (!error && prof) {
        setShowLikes(Boolean(prof.likes_public));
        setIsAdmin(Boolean(prof.is_admin));
        await AsyncStorage.setItem(KEY_SHOW_LIKES_CACHE, String(prof.likes_public));
      }

      const { data: setting } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'restrict_unipaz_email')
        .single();
      if (setting !== null) setRestrictUnipaz(Boolean(setting.value));

      loadBadges();
    })();
  }, []);

  async function toggleUnipazRestrict(next: boolean) {
    if (savingRestrict) return;
    setSavingRestrict(true);
    const prev = restrictUnipaz;
    setRestrictUnipaz(next);
    const { error } = await supabase
      .from('app_settings')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('key', 'restrict_unipaz_email');
    if (error) setRestrictUnipaz(prev);
    setSavingRestrict(false);
  }

  async function toggleLikes(next: boolean) {
    if (!userId || savingLikes) return;
    setSavingLikes(true);
    const prev = showLikes;
    setShowLikes(next);
    await AsyncStorage.setItem(KEY_SHOW_LIKES_CACHE, String(next));
    const { error } = await supabase
      .from('profiles').update({ likes_public: next }).eq('id', userId);
    if (error) {
      setShowLikes(prev);
      await AsyncStorage.setItem(KEY_SHOW_LIKES_CACHE, String(prev));
    }
    setSavingLikes(false);
  }

  const loadStories = async () => {
    if (!userId) return;
    setLoadingStories(true);
    const { data, error } = await supabase
      .from('stories')
      .select('id, title, cover_url, body, category, author_name')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });
    if (!error) setStories(data || []);
    setLoadingStories(false);
  };

  const openEditModal = (story: Story) => {
    setSelectedStory(story);
    setEditTitle(story.title);
    setEditAuthor(story.author_name || '');
    setEditBody(story.body);
    setEditCategory(story.category);
    setShowEditModal(true);
  };

  const saveStoryChanges = async () => {
    if (!selectedStory || !editTitle.trim() || !editBody.trim()) {
      showNotification('Error', 'Título y descripción son obligatorios', 'error');
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from('stories')
      .update({
        title: editTitle.trim(),
        author_name: editAuthor.trim(),
        body: editBody.trim(),
        category: editCategory,
      })
      .eq('id', selectedStory.id);
    setSavingEdit(false);
    if (error) {
      showNotification('Error', 'No se pudo guardar los cambios', 'error');
    } else {
      showNotification('Éxito', 'Historia actualizada correctamente', 'success', 'Listo', async () => {
        setShowSheet(false);
        setSelectedStory(null);
        setShowEditModal(false);
        await loadStories();
      });
    }
  };

  // ── Crear insignia ────────────────────────────────────────────────────────
  const openBadgeModal = () => {
    setBadgeName('');
    setBadgeDesc('');
    setBadgeColor('#FFD700');
    setBadgeIconKey('verified_MI_0');
    setBadgeScope('custom');
    setShowBadgeModal(true);
  };

  const saveBadge = async () => {
    if (!badgeName.trim()) {
      showNotification('Error', 'El nombre es obligatorio', 'error');
      return;
    }
    if (!badgeDesc.trim()) {
      showNotification('Error', 'La descripción es obligatoria', 'error');
      return;
    }
    setSavingBadge(true);
    const { data: insertedBadge, error } = await supabase.from('badges').insert({
      name:        badgeName.trim(),
      description: badgeDesc.trim(),
      color:       badgeColor,
      icon:        badgeIconKey,
      scope:       badgeScope,
    }).select('id').single();
    setSavingBadge(false);
    if (error) {
      showNotification('Error', error.message || 'No se pudo crear la insignia', 'error');
    } else {
      // Auto-asignar según scope
      if (badgeScope === 'admin_only') {
        const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
        if (admins && admins.length > 0) {
          const assignments = admins.map((a: any) => ({
            user_id: a.id,
            badge_id: insertedBadge.id,
            granted_by: userId,
          }));
          await supabase.from('user_badges').insert(assignments);
        }
      } else if (badgeScope === 'all_users') {
        const { data: allUsers } = await supabase.from('profiles').select('id');
        if (allUsers && allUsers.length > 0) {
          const assignments = allUsers.map((u: any) => ({
            user_id: u.id,
            badge_id: insertedBadge.id,
            granted_by: userId,
          }));
          await supabase.from('user_badges').insert(assignments);
        }
      }
      setShowBadgeModal(false);
      loadBadges();
      showNotification('¡Listo!', `Insignia "${badgeName}" creada`, 'success');
    }
  };

  // ── Cargar insignias existentes ─────────────────────────────────────────
  const loadBadges = async () => {
    setLoadingBadges(true);
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .order('name', { ascending: true });
    if (!error) setExistingBadges(data || []);
    setLoadingBadges(false);
  };

  // ── Ver info de insignia ────────────────────────────────────────────────
  const showBadgeInfo = (badge: Badge) => {
    setSelectedBadge(badge);
    setShowBadgeInfoModal(true);
  };

  // ── Abrir edición de insignia ───────────────────────────────────────────
  const openBadgeEdit = (badge: Badge) => {
    setBadgeName(badge.name);
    setBadgeDesc(badge.description);
    setBadgeColor(badge.color);
    setBadgeIconKey(badge.icon || 'verified_MI_0');
    setBadgeScope(badge.scope || 'custom');
    setSelectedBadge(badge);
    setEditingBadge(true);
    setShowBadgeModal(true);
  };

  // ── Guardar edición de insignia ─────────────────────────────────────────
  const updateBadge = async () => {
    if (!selectedBadge) return;
    if (!badgeName.trim()) {
      showNotification('Error', 'El nombre es obligatorio', 'error');
      return;
    }
    if (!badgeDesc.trim()) {
      showNotification('Error', 'La descripción es obligatoria', 'error');
      return;
    }
    setSavingBadge(true);
    const oldScope = selectedBadge.scope;
    const { error } = await supabase
      .from('badges')
      .update({
        name: badgeName.trim(),
        description: badgeDesc.trim(),
        color: badgeColor,
        icon: badgeIconKey,
        scope: badgeScope,
      })
      .eq('id', selectedBadge.id);
    setSavingBadge(false);
    if (error) {
      showNotification('Error', error.message || 'No se pudo actualizar la insignia', 'error');
    } else {
      // Si cambió el scope, re-asignar
      if (oldScope !== badgeScope) {
        // Remover asignaciones anteriores
        await supabase.from('user_badges').delete().eq('badge_id', selectedBadge.id);
        // Re-asignar según nuevo scope
        if (badgeScope === 'admin_only') {
          const { data: admins } = await supabase.from('profiles').select('id').eq('is_admin', true);
          if (admins && admins.length > 0) {
            const assignments = admins.map((a: any) => ({
              user_id: a.id,
              badge_id: selectedBadge.id,
              granted_by: userId,
            }));
            await supabase.from('user_badges').insert(assignments);
          }
        } else if (badgeScope === 'all_users') {
          const { data: allUsers } = await supabase.from('profiles').select('id');
          if (allUsers && allUsers.length > 0) {
            const assignments = allUsers.map((u: any) => ({
              user_id: u.id,
              badge_id: selectedBadge.id,
              granted_by: userId,
            }));
            await supabase.from('user_badges').insert(assignments);
          }
        }
      }
      setShowBadgeModal(false);
      setEditingBadge(false);
      loadBadges();
      showNotification('¡Listo!', `Insignia "${badgeName}" actualizada`, 'success');
    }
  };

  // ── Eliminar insignia ───────────────────────────────────────────────────
  const deleteBadge = async (badge: Badge) => {
    const { error } = await supabase
      .from('badges')
      .delete()
      .eq('id', badge.id);
    if (error) {
      showNotification('Error', 'No se pudo eliminar la insignia', 'error');
    } else {
      loadBadges();
      setShowBadgeInfoModal(false);
      showNotification('Eliminada', `Insignia "${badge.name}" eliminada`, 'success');
    }
  };

  function logout() { setConfirmOpen(true); }

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

  if (!fontsLoaded) {
    return (
      <View style={s.screen}>
        <Text style={{ color: '#F3F4F6', textAlign: 'center', marginTop: 50 }}>Cargando...</Text>
      </View>
    );
  }

  // Key única por ícono en el array
  function iconKey(ic: typeof BADGE_ICONS[0], i: number) {
    return ic.set === 'MaterialIcons' ? `${ic.name}_MI_${i}` : ic.name;
  }

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={[s.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={s.headerBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Risque_400Regular', fontSize: 22, color: '#F3F4F6', letterSpacing: 0.5, flex: 1, textAlign: 'center' }}>
          Configuración
        </Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: insets.bottom > 0 ? insets.bottom + 24 : 28 }]} showsVerticalScrollIndicator={false}>
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

        <TouchableOpacity style={s.row} onPress={() => { loadStories(); setShowEditModal(true); }}>
          <Ionicons name="book-outline" size={18} color="#E5E7EB" />
          <Text style={s.rowLabel}>Editar Historias Subidas</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        {/* ── SECCIÓN ADMIN ─────────────────────────────────────────────── */}
        {isAdmin && (
          <>
            <View style={s.adminDivider}>
              <View style={s.adminDividerLine} />
              <Text style={s.adminDividerText}>ADMINISTRADOR</Text>
              <View style={s.adminDividerLine} />
            </View>

            <SettingRow icon="school-outline" label="Registro solo @unipaz.edu.co">
              <Switch
                value={restrictUnipaz}
                onValueChange={toggleUnipazRestrict}
                disabled={savingRestrict}
                thumbColor={restrictUnipaz ? '#60A5FA' : '#374151'}
                trackColor={{ true: '#1E3A5F', false: '#111827' }}
              />
            </SettingRow>

            <TouchableOpacity style={s.row} onPress={() => { setEditingBadge(false); openBadgeModal(); }} activeOpacity={0.8}>
              <MaterialIcons name="add-circle-outline" size={18} color="#F3F4F6" />
              <Text style={s.rowLabel}>Crear Insignia</Text>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Insignias existentes */}
            <View style={s.badgesSection}>
              <Text style={s.badgesSectionTitle}>Insignias Creadas</Text>
              {loadingBadges ? (
                <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#6B7280' }}>Cargando...</Text>
                </View>
              ) : existingBadges.length === 0 ? (
                <Text style={{ color: '#6B7280', fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>
                  No hay insignias aún
                </Text>
              ) : (
                <View style={{ gap: 8, marginTop: 8 }}>
                  {existingBadges.map((badge) => (
                    <TouchableOpacity
                      key={badge.id}
                      style={s.badgeItem}
                      onPress={() => showBadgeInfo(badge)}
                      activeOpacity={0.7}
                    >
                      <BadgeIcon iconKey={badge.icon || 'verified_MI_0'} size={20} color={badge.color} />
                      <Text style={s.badgeItemName} numberOfLines={1}>{badge.name}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); openBadgeEdit(badge); }}
                          hitSlop={6}
                        >
                          <Ionicons name="create-outline" size={16} color="#60A5FA" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); deleteBadge(badge); }}
                          hitSlop={6}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.85}>
          <Text style={s.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── MODAL CREAR INSIGNIA ─────────────────────────────────────────── */}
      <Modal visible={showBadgeModal} transparent animationType="slide" onRequestClose={() => setShowBadgeModal(false)}>
        <SafeAreaView style={s.screen}>
          <View style={[s.header, { position: 'relative', paddingTop: insets.top, height: 56 + insets.top }]}>
            <TouchableOpacity onPress={() => setShowBadgeModal(false)} style={s.headerBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>{editingBadge ? 'Editar Insignia' : 'Nueva Insignia'}</Text>
            <View style={s.headerBtn} />
          </View>

          <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ gap: 20, paddingBottom: insets.bottom + 30 }}>

            {/* Preview */}
            <View style={s.badgePreviewWrap}>
              <View style={[s.badgePreview, { borderColor: badgeColor }]}>
                <BadgeIcon iconKey={badgeIconKey} size={28} color={badgeColor} />
                <Text style={[s.badgePreviewName, { color: badgeColor }]} numberOfLines={1}>
                  {badgeName || 'Nombre de insignia'}
                </Text>
              </View>
              <Text style={s.badgePreviewHint}>Vista previa</Text>
            </View>

            {/* Nombre */}
            <View>
              <Text style={s.editLabel}>Nombre *</Text>
              <TextInput
                style={s.editInput}
                placeholder="Ej: Usuario verificado"
                placeholderTextColor="#666"
                value={badgeName}
                onChangeText={setBadgeName}
                maxLength={40}
              />
            </View>

            {/* Descripción */}
            <View>
              <Text style={s.editLabel}>Descripción *</Text>
              <TextInput
                style={[s.editInput, s.editTextArea]}
                placeholder="Ej: Cuenta verificada por el equipo de U-PAZ"
                placeholderTextColor="#666"
                value={badgeDesc}
                onChangeText={setBadgeDesc}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={120}
              />
            </View>

            {/* Alcance */}
            <View>
              <Text style={s.editLabel}>¿Para quién es?</Text>
              <View style={s.scopeRow}>
                <TouchableOpacity
                  style={[s.scopeBtn, badgeScope === 'admin_only' && { borderColor: badgeColor, backgroundColor: '#111' }]}
                  onPress={() => setBadgeScope('admin_only')}
                >
                  <Ionicons name="shield-checkmark" size={18} color={badgeScope === 'admin_only' ? badgeColor : '#6B7280'} />
                  <Text style={[s.scopeBtnText, badgeScope === 'admin_only' && { color: badgeColor }]}>Solo Admins</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.scopeBtn, badgeScope === 'all_users' && { borderColor: badgeColor, backgroundColor: '#111' }]}
                  onPress={() => setBadgeScope('all_users')}
                >
                  <Ionicons name="people" size={18} color={badgeScope === 'all_users' ? badgeColor : '#6B7280'} />
                  <Text style={[s.scopeBtnText, badgeScope === 'all_users' && { color: badgeColor }]}>Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.scopeBtn, badgeScope === 'custom' && { borderColor: badgeColor, backgroundColor: '#111' }]}
                  onPress={() => setBadgeScope('custom')}
                >
                  <Ionicons name="person-add" size={18} color={badgeScope === 'custom' ? badgeColor : '#6B7280'} />
                  <Text style={[s.scopeBtnText, badgeScope === 'custom' && { color: badgeColor }]}>Manual</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Color */}
            <View>
              <Text style={s.editLabel}>Color</Text>
              <View style={s.colorGrid}>
                {BADGE_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setBadgeColor(c)}
                    style={[s.colorDot, { backgroundColor: c }, badgeColor === c && s.colorDotSelected]}
                  >
                    {badgeColor === c && <Ionicons name="checkmark" size={14} color="#000" />}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Ícono */}
            <View>
              <Text style={s.editLabel}>Ícono</Text>
              <View style={s.iconGrid}>
                {BADGE_ICONS.map((ic, i) => {
                  const key = iconKey(ic, i);
                  const selected = badgeIconKey === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setBadgeIconKey(key)}
                      style={[s.iconOption, selected && { borderColor: badgeColor, backgroundColor: '#111' }]}
                    >
                      <BadgeIcon iconKey={key} size={24} color={selected ? badgeColor : '#6B7280'} />
                      <Text style={[s.iconOptionLabel, selected && { color: badgeColor }]}>
                        {ic.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Guardar */}
            <TouchableOpacity
              style={[s.saveBtn, savingBadge && { opacity: 0.5 }]}
              onPress={editingBadge ? updateBadge : saveBadge}
              disabled={savingBadge}
            >
              <Text style={s.saveBtnText}>
                {savingBadge ? 'Guardando...' : (editingBadge ? 'Actualizar Insignia' : 'Crear Insignia')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal selección historias */}
      <Modal visible={showEditModal && !selectedStory} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <SafeAreaView style={s.screen}>
          <View style={[s.header, { position: 'relative', paddingTop: insets.top, height: 56 + insets.top }]}>
            <TouchableOpacity onPress={() => setShowEditModal(false)} style={s.headerBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Mis Historias</Text>
            <View style={s.headerBtn} />
          </View>
          {loadingStories ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#F3F4F6' }}>Cargando...</Text>
            </View>
          ) : stories.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#A1A1AA' }}>No tienes historias aún</Text>
            </View>
          ) : (
            <FlatList
              data={stories}
              keyExtractor={it => it.id}
              numColumns={2}
              contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: insets.bottom + 20 }}
              columnWrapperStyle={{ gap: 12 }}
              removeClippedSubviews
              maxToRenderPerBatch={20}
              updateCellsBatchingPeriod={50}
              initialNumToRender={20}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.storyGridItem, !item.cover_url && s.storyGridItemSmall]}
                  onPress={() => openEditModal(item)}
                >
                  {item.cover_url ? (
                    <Image source={{ uri: item.cover_url }} style={s.storyGridImage} />
                  ) : (
                    <View style={s.storyGridPlaceholder}>
                      <Text style={s.storyGridPlaceholderTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={s.storyGridPlaceholderBody} numberOfLines={2}>{item.body}</Text>
                    </View>
                  )}
                  <View style={s.storyGridOverlay}>
                    <Text style={s.storyGridTitle} numberOfLines={2}>{item.title}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Modal edición historia */}
      <Modal
        visible={showEditModal && selectedStory !== null}
        transparent animationType="slide"
        onRequestClose={() => { setSelectedStory(null); setShowEditModal(false); }}
      >
        <SafeAreaView style={s.screen}>
          <View style={[s.header, { position: 'relative', paddingTop: insets.top, height: 56 + insets.top }]}>
            <TouchableOpacity onPress={() => setSelectedStory(null)} style={s.headerBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Editar Historia</Text>
            <View style={s.headerBtn} />
          </View>
          <ScrollView style={s.editContent} contentContainerStyle={{ gap: 16, paddingBottom: insets.bottom > 0 ? insets.bottom + 20 : 30 }}>
            <View>
              <Text style={s.editLabel}>Título</Text>
              <TextInput style={s.editInput} placeholderTextColor="#666" value={editTitle} onChangeText={setEditTitle} />
            </View>
            <View>
              <Text style={s.editLabel}>Autor</Text>
              <TextInput style={s.editInput} placeholderTextColor="#666" value={editAuthor} onChangeText={setEditAuthor} />
            </View>
            <View>
              <Text style={s.editLabel}>Categoría</Text>
              <View style={s.categorySelect}>
                {['Urbana', 'Leyenda', 'Mitos'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setEditCategory(cat)}
                    style={[s.categoryBtn, editCategory === cat && s.categoryBtnActive]}
                  >
                    <Text style={[s.categoryBtnText, editCategory === cat && s.categoryBtnTextActive]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <Text style={s.editLabel}>Descripción</Text>
              <TextInput
                style={[s.editInput, s.editTextArea]}
                placeholderTextColor="#666"
                value={editBody}
                onChangeText={setEditBody}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
            <TouchableOpacity
              style={[s.saveBtn, savingEdit && { opacity: 0.6 }]}
              onPress={saveStoryChanges}
              disabled={savingEdit}
            >
              <Text style={s.saveBtnText}>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal notificación */}
      <Modal visible={showSheet} transparent animationType="fade" onRequestClose={() => setShowSheet(false)}>
        <View style={[s.overlay, { paddingBottom: insets.bottom }]}>
          <Pressable style={s.backdrop} onPress={() => setShowSheet(false)} />
          <View style={s.sheet}>
            <View style={[
              s.iconWrap,
              sheet.variant === 'error'   ? { backgroundColor: '#3F1D1D', borderColor: '#7F1D1D' }
              : sheet.variant === 'success' ? { backgroundColor: '#1D3F1D', borderColor: '#1D7F1D' }
              : { backgroundColor: '#1F2937', borderColor: '#374151' },
            ]}>
              <Ionicons
                name={sheet.variant === 'error' ? 'alert-circle' : sheet.variant === 'success' ? 'checkmark-circle' : 'information-circle'}
                size={24}
                color={sheet.variant === 'error' ? '#F87171' : sheet.variant === 'success' ? '#4ADE80' : '#93C5FD'}
              />
            </View>
            <Text style={s.sheetTitle}>{sheet.title}</Text>
            <Text style={s.sheetMsg}>{sheet.message}</Text>
            <View style={s.sheetActions}>
              <TouchableOpacity style={[s.sheetBtn, s.sheetBtnPrimary]} onPress={sheet.onConfirm}>
                <Text style={s.sheetBtnText}>{sheet.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal info de insignia */}
      <Modal visible={showBadgeInfoModal} transparent animationType="fade" onRequestClose={() => setShowBadgeInfoModal(false)}>
        <View style={s.badgeInfoOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowBadgeInfoModal(false)} />
          {selectedBadge && (
            <View style={s.badgeInfoContent}>
              <TouchableOpacity style={s.badgeInfoClose} onPress={() => setShowBadgeInfoModal(false)}>
                <Ionicons name="close-circle" size={28} color="#F3F4F6" />
              </TouchableOpacity>
              <View style={s.badgeInfoIconWrap}>
                <BadgeIcon iconKey={selectedBadge.icon || 'verified_MI_0'} size={56} color={selectedBadge.color} />
              </View>
              <Text style={s.badgeInfoTitle}>{selectedBadge.name}</Text>
              <Text style={s.badgeInfoDesc}>{selectedBadge.description}</Text>
              <View style={s.badgeInfoActions}>
                <TouchableOpacity
                  style={[s.badgeInfoBtn, { backgroundColor: '#1F2937' }]}
                  onPress={() => { setShowBadgeInfoModal(false); openBadgeEdit(selectedBadge); }}
                >
                  <Ionicons name="create-outline" size={16} color="#F3F4F6" />
                  <Text style={s.badgeInfoBtnText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.badgeInfoBtn, { backgroundColor: '#7F1D1D' }]}
                  onPress={() => deleteBadge(selectedBadge)}
                >
                  <Ionicons name="trash-outline" size={16} color="#F87171" />
                  <Text style={[s.badgeInfoBtnText, { color: '#F87171' }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Modal logout */}
      <Modal visible={confirmOpen} transparent animationType="fade" onRequestClose={() => !loggingOut && setConfirmOpen(false)}>
        <View style={[s.overlay, { paddingBottom: insets.bottom }]}>
          <Pressable style={s.backdrop} onPress={() => !loggingOut && setConfirmOpen(false)} />
          <View style={s.sheet}>
            <View style={s.iconWrap}>
              <Ionicons name="log-out-outline" size={24} color="#F87171" />
            </View>
            <Text style={s.sheetTitle}>Cerrar sesión</Text>
            <Text style={s.sheetMsg}>¿Seguro que quieres salir?</Text>
            <View style={s.sheetActions}>
              <TouchableOpacity style={[s.sheetBtn, s.sheetBtnSecondary]} onPress={() => setConfirmOpen(false)} disabled={loggingOut}>
                <Text style={s.sheetBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.sheetBtn, s.sheetBtnPrimary]} onPress={doLogout} disabled={loggingOut}>
                <Text style={s.sheetBtnText}>{loggingOut ? 'Saliendo…' : 'Salir'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingRow({ icon, label, children }: { icon: string; label: string; children?: React.ReactNode }) {
  return (
    <View style={s.row}>
      <Ionicons name={icon as any} size={18} color="#E5E7EB" />
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowAction}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000ff' },
  header: {
    backgroundColor: '#000000ff', height: 56, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#000000ff', zIndex: 1000,
  },
  headerBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  content: { padding: 16, gap: 12 },
  row: {
    backgroundColor: '#010102ff', borderRadius: 14, borderWidth: 1,
    borderColor: '#181818ff', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  rowLabel: { color: '#F3F4F6', fontSize: 16, flex: 1, flexShrink: 1 },
  rowAction: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center' },
  comingSoon: { color: '#9CA3AF', fontSize: 13 },
  logoutBtn: { marginTop: 'auto', paddingVertical: 16, alignItems: 'center' },
  logoutText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },

  adminDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  adminDividerLine: { flex: 1, height: 1, backgroundColor: '#1f1f1f' },
  adminDividerText: { color: '#4B5563', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },

  // Insignias sección
  badgesSection: { marginTop: 12, gap: 4 },
  badgesSectionTitle: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0A0A0A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F1F27',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  badgeItemName: { color: '#F3F4F6', fontSize: 14, fontWeight: '600', flex: 1 },

  // Scope selector
  scopeRow: { flexDirection: 'row', gap: 8 },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#242424',
    backgroundColor: '#0A0A0A',
  },
  scopeBtnText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  // Badge info modal
  badgeInfoContent: {
    backgroundColor: '#121219',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#1F1F27',
    alignItems: 'center',
    alignSelf: 'center',
  },
  badgeInfoClose: { position: 'absolute', top: 12, right: 12, zIndex: 20 },
  badgeInfoIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A22',
    borderWidth: 2,
    borderColor: '#2A2A35',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  badgeInfoTitle: { color: '#F3F4F6', fontSize: 22, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  badgeInfoDesc: { color: '#D1D5DB', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
  badgeInfoActions: { width: '100%', flexDirection: 'row', gap: 10 },
  badgeInfoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
  },
  badgeInfoBtnText: { fontSize: 15, fontWeight: '700' },

  badgePreviewWrap: { alignItems: 'center', gap: 8 },
  badgePreview: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, backgroundColor: '#0A0A0A',
  },
  badgePreviewName: { fontSize: 16, fontWeight: '700' },
  badgePreviewHint: { color: '#4B5563', fontSize: 11 },

  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorDotSelected: { borderWidth: 2.5, borderColor: '#fff', transform: [{ scale: 1.15 }] },

  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: {
    width: '18%', aspectRatio: 1, borderRadius: 10,
    borderWidth: 1, borderColor: '#242424', backgroundColor: '#0A0A0A',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: 4,
  },
  iconOptionLabel: { color: '#4B5563', fontSize: 8, fontWeight: '600', textAlign: 'center' },

  storyGridItem: { flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#181818ff' },
  storyGridItemSmall: { aspectRatio: 2 },
  storyGridImage: { width: '100%', height: '100%' },
  storyGridPlaceholder: { width: '100%', height: '100%', backgroundColor: '#010102ff', justifyContent: 'center', alignItems: 'center', padding: 12 },
  storyGridPlaceholderTitle: { color: '#F3F4F6', fontWeight: '700', fontSize: 13, textAlign: 'center', marginBottom: 6 },
  storyGridPlaceholderBody: { color: '#A1A1AA', fontSize: 11, textAlign: 'center', lineHeight: 14 },
  storyGridOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', padding: 8 },
  storyGridTitle: { color: '#F3F4F6', fontWeight: '600', fontSize: 12 },

  editContent: { padding: 16, flex: 1 },
  editLabel: { color: '#F3F4F6', fontWeight: '600', marginBottom: 8 },
  editInput: {
    backgroundColor: '#010102ff', borderWidth: 1, borderColor: '#181818ff',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#F3F4F6', fontSize: 14,
  },
  editTextArea: { height: 120, textAlignVertical: 'top' },
  categorySelect: { flexDirection: 'row', gap: 8 },
  categoryBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#181818ff', alignItems: 'center' },
  categoryBtnActive: { backgroundColor: '#1f1f1fff', borderColor: '#F3F4F6' },
  categoryBtnText: { color: '#A1A1AA', fontWeight: '600', fontSize: 12 },
  categoryBtnTextActive: { color: '#F3F4F6' },
  saveBtn: { backgroundColor: '#1f1f1fff', borderWidth: 1, borderColor: '#27272A', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnText: { color: '#F3F4F6', fontWeight: '600', fontSize: 16 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  badgeInfoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  backdrop: { flex: 1 },
  sheet: { width: '100%', backgroundColor: '#010102ff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, borderTopWidth: 1, borderColor: '#181818ff' },
  iconWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  sheetTitle: { color: '#F3F4F6', fontWeight: '700', fontSize: 18, textAlign: 'center' },
  sheetMsg: { color: '#D1D5DB', textAlign: 'center', marginTop: 6 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'center' },
  sheetBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sheetBtnPrimary: { backgroundColor: '#1F2937', borderColor: '#6b0404ff' },
  sheetBtnSecondary: { backgroundColor: 'transparent', borderColor: '#27272A' },
  sheetBtnText: { fontWeight: '600', color: '#fff' },
});
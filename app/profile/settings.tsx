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
import { Ionicons, AntDesign } from '@expo/vector-icons';
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


export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    Risque_400Regular,
  });

  const [showLikes, setShowLikes] = useState(true);
  const [savingLikes, setSavingLikes] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [stories, setStories] = useState<Story[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCategory, setEditCategory] = useState('Urbana');
  const [savingEdit, setSavingEdit] = useState(false);
  const [loadingStories, setLoadingStories] = useState(false);

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
      title,
      message,
      confirmText,
      variant,
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


  const loadStories = async () => {
    if (!userId) return;
    setLoadingStories(true);

    const { data, error } = await supabase
      .from('stories')
      .select('id, title, cover_url, body, category, author_name')
      .eq('author_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando historias:', error);
    } else {
      setStories(data || []);
    }
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
      console.error('Error:', error);
    } else {
      showNotification('Éxito', 'Historia actualizada correctamente', 'success', 'Listo', async () => {
        setShowSheet(false);
        setSelectedStory(null);
        setShowEditModal(false);
        await loadStories();
      });
    }
  };


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
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={[s.header, { paddingTop: insets.top }]}>
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

      <View style={[s.content, { paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 20, flex: 1 }]}>
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

        <TouchableOpacity 
          style={s.row}
          onPress={() => {
            loadStories();
            setShowEditModal(true);
          }}
        >
          <Ionicons name="book-outline" size={18} color="#E5E7EB" />
          <Text style={s.rowLabel}>Editar Historias Subidas</Text>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.85}>
          <Text style={s.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de selección de historias */}
      <Modal
        visible={showEditModal && !selectedStory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={s.screen}>
          <View style={[s.header, { position: 'relative', paddingTop: insets.top }]}>
            <TouchableOpacity
              onPress={() => setShowEditModal(false)}
              style={s.headerBtn}
              hitSlop={10}
            >
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
              removeClippedSubviews={true}
              maxToRenderPerBatch={20}
              updateCellsBatchingPeriod={50}
              initialNumToRender={20}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.storyGridItem, !item.cover_url && s.storyGridItemSmall]}
                  onPress={() => openEditModal(item)}
                >
                  {item.cover_url ? (
                    <Image source={{ uri: item.cover_url }} style={s.storyGridImage} />
                  ) : (
                    // 👇 NUEVO: Rectángulo de mitad de altura
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

      {/* Modal de edición */}
      <Modal
        visible={showEditModal && selectedStory !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedStory(null);
          setShowEditModal(false);
        }}
      >
        <SafeAreaView style={s.screen}>
          <View style={[s.header, { position: 'relative', paddingTop: insets.top }]}>
            <TouchableOpacity
              onPress={() => setSelectedStory(null)}
              style={s.headerBtn}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
            </TouchableOpacity>
            <Text style={s.headerTitle}>Editar Historia</Text>
            <View style={s.headerBtn} />
          </View>

          <ScrollView 
            style={s.editContent} 
            contentContainerStyle={{ 
              gap: 16,
              paddingBottom: insets.bottom > 0 ? insets.bottom + 20 : 30
            }}
          >
            <View>
              <Text style={s.editLabel}>Título</Text>
              <TextInput
                style={s.editInput}
                placeholderTextColor="#666"
                value={editTitle}
                onChangeText={setEditTitle}
              />
            </View>

            <View>
              <Text style={s.editLabel}>Autor</Text>
              <TextInput
                style={s.editInput}
                placeholderTextColor="#666"
                value={editAuthor}
                onChangeText={setEditAuthor}
              />
            </View>

            <View>
              <Text style={s.editLabel}>Categoría</Text>
              <View style={s.categorySelect}>
                {['Urbana', 'Leyenda', 'Mitos'].map(cat => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setEditCategory(cat)}
                    style={[
                      s.categoryBtn,
                      editCategory === cat && s.categoryBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        s.categoryBtnText,
                        editCategory === cat && s.categoryBtnTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
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

      {/* Modal de notificación */}
      <Modal
        visible={showSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSheet(false)}
      >
        <View style={[s.overlay, { paddingBottom: insets.bottom }]}>
          <Pressable style={s.backdrop} onPress={() => setShowSheet(false)} />
          <View style={s.sheet}>
            <View
              style={[
                s.iconWrap,
                sheet.variant === 'error'
                  ? { backgroundColor: '#3F1D1D', borderColor: '#7F1D1D' }
                  : sheet.variant === 'success'
                  ? { backgroundColor: '#1D3F1D', borderColor: '#1D7F1D' }
                  : { backgroundColor: '#1F2937', borderColor: '#374151' },
              ]}
            >
              <Ionicons
                name={
                  sheet.variant === 'error'
                    ? 'alert-circle'
                    : sheet.variant === 'success'
                    ? 'checkmark-circle'
                    : 'information-circle'
                }
                size={24}
                color={
                  sheet.variant === 'error'
                    ? '#F87171'
                    : sheet.variant === 'success'
                    ? '#4ADE80'
                    : '#93C5FD'
                }
              />
            </View>

            <Text style={s.sheetTitle}>{sheet.title}</Text>
            <Text style={s.sheetMsg}>{sheet.message}</Text>

            <View style={s.sheetActions}>
              <TouchableOpacity
                style={[s.sheetBtn, s.sheetBtnPrimary]}
                onPress={sheet.onConfirm}
              >
                <Text style={s.sheetBtnText}>{sheet.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de logout */}
      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !loggingOut && setConfirmOpen(false)}
      >
        <View style={[s.overlay, { paddingBottom: insets.bottom }]}>
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
  children?: React.ReactNode;
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

  header: {
    backgroundColor: '#000000ff',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#000000ff',
    zIndex: 1000,
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
    flex: 1,
    textAlign: 'center',
  },

  content: {
    padding: 16,
    gap: 12,
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
    marginTop: 'auto',
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },

  storyGridItem: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#181818ff',
  },
  storyGridItemSmall: {
    aspectRatio: 2,
  },
  storyGridImage: {
    width: '100%',
    height: '100%',
  },
  storyGridPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#010102ff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  storyGridPlaceholderTitle: {
    color: '#F3F4F6',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 6,
  },
  storyGridPlaceholderBody: {
    color: '#A1A1AA',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  storyGridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
  },
  storyGridTitle: {
    color: '#F3F4F6',
    fontWeight: '600',
    fontSize: 12,
  },

  editContent: {
    padding: 16,
    flex: 1,
  },
  editLabel: {
    color: '#F3F4F6',
    fontWeight: '600',
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: '#010102ff',
    borderWidth: 1,
    borderColor: '#181818ff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F3F4F6',
    fontSize: 14,
  },
  editTextArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  categorySelect: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#181818ff',
    alignItems: 'center',
  },
  categoryBtnActive: {
    backgroundColor: '#1f1f1fff',
    borderColor: '#F3F4F6',
  },
  categoryBtnText: {
    color: '#A1A1AA',
    fontWeight: '600',
    fontSize: 12,
  },
  categoryBtnTextActive: {
    color: '#F3F4F6',
  },
  saveBtn: {
    backgroundColor: '#1f1f1fff',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#F3F4F6',
    fontWeight: '600',
    fontSize: 16,
  },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    width: '100%',
    backgroundColor: '#010102ff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#181818ff',
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    justifyContent: 'center',
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
    backgroundColor: '#1F2937',
    borderColor: '#6b0404ff',
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

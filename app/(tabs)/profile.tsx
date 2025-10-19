// app/(tabs)/profile.tsx
import { useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Link, useNavigation, useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';

// ==== Tipos ====
type DBStory = {
  id: string;
  title: string;
  body: string;
  cover_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_id: string;
  author_name: string | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  }[] | null;
  liked_at?: string; // para ordenar "Me gusta"
};

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  likes_public: boolean;
};

// ==== Helpers upload ====
function getExtAndType(uri: string) {
  const ext = (uri.split('.').pop() || '').toLowerCase();
  if (ext === 'png') return { ext: 'png', type: 'image/png' };
  if (ext === 'webp') return { ext: 'webp', type: 'image/webp' };
  if (ext === 'jpg' || ext === 'jpeg') return { ext: 'jpg', type: 'image/jpeg' };
  if (ext === 'heic') return { ext: 'heic', type: 'image/heic' };
  return { ext: 'jpg', type: 'image/jpeg' };
}

async function uriToArrayBuffer(uri: string) {
  const res: any = await fetch(uri);
  // @ts-ignore
  const ab = await res.arrayBuffer();
  return ab as ArrayBuffer;
}

export default function Profile() {
  const navigation = useNavigation();
  const router = useRouter();

  const [displayName, setDisplayName] = useState<string>('Usuario');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [likesPublic, setLikesPublic] = useState<boolean>(true);

  const [tab, setTab] = useState<'mine' | 'likes'>('mine');
  const [myStories, setMyStories] = useState<DBStory[]>([]);
  const [likedStories, setLikedStories] = useState<DBStory[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Set con ids likeados para pintar corazón rojo y togglear
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // ---- Sheet elegante (igual que en login) ----
  const [showSheet, setShowSheet] = useState(false);
  const [sheet, setSheet] = useState<{
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    variant: 'info' | 'error';
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
    variant: 'info' | 'error' = 'info',
    confirmText = 'Cerrar'
  ) {
    setSheet({
      title,
      message,
      confirmText,
      variant,
      onConfirm: () => setShowSheet(false),
    });
    setShowSheet(true);
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'PAZ',
      headerRight: () => (
        <TouchableOpacity onPress={() => router.push('/profile/settings')} style={{ marginRight: 12 }} hitSlop={10}>
          <Ionicons name="settings-outline" size={22} color="#F3F4F6" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, router]);

  const loadFromSupabase = useCallback(async () => {
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const uid = authData.user?.id ?? null;
      setUserId(uid);

      if (!uid) {
        setDisplayName('Usuario');
        setAvatarUrl(null);
        setMyStories([]);
        setLikedStories([]);
        setLikedIds(new Set());
        return;
      }

      // Perfil
      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, likes_public')
        .eq('id', uid)
        .single<ProfileRow>();

      setDisplayName(prof?.display_name || 'Usuario');
      setAvatarUrl(prof?.avatar_url ?? null);
      setLikesPublic(prof?.likes_public ?? true);

      // ==== Mis historias (con embed del autor) ====
      const { data: mine, error: mineErr } = await supabase
        .from('stories')
        .select(`
          id,
          title,
          body,
          cover_url,
          likes_count,
          comments_count,
          created_at,
          author_id,
          author_name,
          profiles!stories_author_id_fkey ( display_name, avatar_url )
        `)
        .eq('author_id', uid)
        .order('created_at', { ascending: false });
      if (mineErr) throw mineErr;

      const myStoriesWithAuthor = (mine ?? []).map((story: any) => {
        if (!story.profiles || story.profiles.length === 0) {
          return {
            ...story,
            profiles: [{ display_name: prof?.display_name || 'Tú', avatar_url: prof?.avatar_url ?? null }],
          };
        }
        return story;
      });
      setMyStories(myStoriesWithAuthor);

      // ==== Mis likes: ordenar por CUÁNDO diste like y garantizar avatar del autor ====
      const { data: likeRows, error: likeErr } = await supabase
        .from('story_likes')
        .select('story_id, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (likeErr) throw likeErr;

      const ids = (likeRows || []).map((r: any) => r.story_id as string);
      setLikedIds(new Set(ids));

      if (ids.length === 0) {
        setLikedStories([]);
      } else {
        const likedAtMap = new Map<string, string>();
        (likeRows || []).forEach((r: any) => likedAtMap.set(r.story_id, r.created_at));

        const { data: liked, error: likedErr } = await supabase
          .from('stories')
          .select(`
            id,
            title,
            body,
            cover_url,
            likes_count,
            comments_count,
            created_at,
            author_id,
            author_name,
            profiles!stories_author_id_fkey ( display_name, avatar_url )
          `)
          .in('id', ids);
        if (likedErr) throw likedErr;

        // --- Paso A: backfill de display_name básico si no hay embed ---
        let likedWithAuthor: DBStory[] = (liked ?? []).map((story: any) => {
          if (!story.profiles || story.profiles.length === 0) {
            return {
              ...story,
              profiles: [{ display_name: story.author_name || 'Autor', avatar_url: null }],
            };
          }
          return story;
        });

        // --- Paso B: traer perfiles de TODOS los author_id y rellenar avatar si falta ---
        const authorIds = Array.from(new Set(likedWithAuthor.map(s => s.author_id)));
        if (authorIds.length) {
          const { data: authorProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', authorIds);

          const pMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
          (authorProfiles ?? []).forEach((p: any) => {
            pMap.set(p.id, { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null });
          });

          likedWithAuthor = likedWithAuthor.map(st => {
            const current = st.profiles?.[0] ?? null;
            const fromMap = pMap.get(st.author_id) ?? null;

            // si falta avatar o falta profile, lo rellenamos
            if (!current || current.avatar_url == null || current.display_name == null) {
              const display_name = current?.display_name ?? fromMap?.display_name ?? st.author_name ?? 'Autor';
              const avatar_url =
                // Si es TU historia, usa tu avatar como último fallback
                (st.author_id === uid ? (prof?.avatar_url ?? null) : null) ??
                current?.avatar_url ??
                fromMap?.avatar_url ??
                null;

              return { ...st, profiles: [{ display_name, avatar_url }] };
            }
            return st;
          });
        }

        // --- Paso C: adjuntar liked_at y ordenar por liked_at desc ---
        likedWithAuthor = likedWithAuthor.map(st => ({ ...st, liked_at: likedAtMap.get(st.id) }));
        likedWithAuthor.sort((a, b) => {
          const da = a.liked_at ?? a.created_at;
          const db = b.liked_at ?? b.created_at;
          return db.localeCompare(da);
        });

        setLikedStories(likedWithAuthor);
      }
    } catch (e: any) {
      showNotification('Error', e?.message ?? 'No se pudo cargar tu perfil.', 'error');
    }
  }, []);

  useEffect(() => { loadFromSupabase(); }, [loadFromSupabase]);
  useFocusEffect(useCallback(() => { loadFromSupabase(); }, [loadFromSupabase]));

  // ===== Avatar & portada =====
  async function pickImage(): Promise<string | null> {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      showNotification('Permiso', 'Necesitamos acceso a tu galería para cambiar la imagen.', 'error');
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (res.canceled) return null;
    return res.assets[0].uri;
  }

  // Upload avatar usando ArrayBuffer
  async function onChangeAvatar() {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) return;

      const localUri = await pickImage();
      if (!localUri) return;

      const { ext, type } = getExtAndType(localUri);
      const ab = await uriToArrayBuffer(localUri);
      const path = `${uid}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('covers')
        .upload(path, ab, { upsert: true, contentType: type, cacheControl: '3600' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
      const url = pub.publicUrl;

      const { error: profErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
      if (profErr) {
        showNotification('Error', 'No se pudo actualizar el avatar. Verifica que tienes permisos.', 'error');
        console.error('Error al actualizar avatar:', profErr);
        return;
      }

      setAvatarUrl(url);
      showNotification('Listo', 'Tu foto de perfil ha sido actualizada.', 'info');
    } catch (e: any) {
      showNotification('Error', e?.message ?? 'No se pudo actualizar el avatar.', 'error');
    }
  }

  // ===== Toggle Like (optimista) =====
  const toggleLike = useCallback(
    async (story: DBStory) => {
      if (!userId) return;
      const isLiked = likedIds.has(story.id);

      // Optimista: actualizar estados locales
      setLikedIds(prev => {
        const next = new Set(prev);
        if (isLiked) next.delete(story.id);
        else next.add(story.id);
        return next;
      });

      const adjustCount = (arr: DBStory[], id: string, delta: number) =>
        arr.map(s => (s.id === id ? { ...s, likes_count: Math.max(0, (s.likes_count || 0) + delta) } : s));

      setMyStories(curr => adjustCount(curr, story.id, isLiked ? -1 : +1));

      if (tab === 'likes') {
        if (isLiked) {
          setLikedStories(curr => curr.filter(s => s.id !== story.id));
        } else {
          setLikedStories(curr => [
            { ...story, liked_at: new Date().toISOString(), likes_count: (story.likes_count || 0) + 1 },
            ...curr.filter(s => s.id !== story.id),
          ]);
        }
      } else {
        setLikedStories(curr => adjustCount(curr, story.id, isLiked ? -1 : +1));
      }

      // Persistir en BD
      if (isLiked) {
        const { error } = await supabase
          .from('story_likes')
          .delete()
          .match({ user_id: userId, story_id: story.id });
        if (error) {
          setLikedIds(prev => new Set(prev).add(story.id));
          showNotification('Ups', 'No se pudo quitar tu like. Intenta de nuevo.', 'error');
        }
      } else {
        const { error } = await supabase
          .from('story_likes')
          .insert({ user_id: userId, story_id: story.id });
        if (error) {
          setLikedIds(prev => {
            const next = new Set(prev);
            next.delete(story.id);
            return next;
          });
          showNotification('Ups', 'No se pudo registrar tu like. Intenta de nuevo.', 'error');
        }
      }
    },
    [userId, likedIds, tab]
  );

  const listData = useMemo(() => (tab === 'mine' ? myStories : likedStories), [tab, myStories, likedStories]);

  return (
    <View style={s.screen}>
      {/* Avatar + nombre */}
      <View style={s.avatarRow}>
        <View style={s.avatarWrap}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: '#0F1016' }]} />}
          <TouchableOpacity style={s.editAvatarBtn} onPress={onChangeAvatar} hitSlop={10}>
            <Ionicons name="camera-outline" size={16} color="#F3F4F6" />
          </TouchableOpacity>
        </View>
        <Text style={s.name}>{displayName}</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity onPress={() => setTab('mine')} style={[s.tabBtn, tab === 'mine' && s.tabBtnActive]}>
          <Text style={[s.tabTxt, tab === 'mine' && s.tabTxtActive]}>
            {`Mis Historias ${myStories.length}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('likes')} style={[s.tabBtn, tab === 'likes' && s.tabBtnActive, !likesPublic && { borderColor: '#374151' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.tabTxt, tab === 'likes' && s.tabTxtActive]}>Me gusta</Text>
            {!likesPublic && <Ionicons name="lock-closed-outline" size={14} color="#9CA3AF" />}
          </View>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <FlatList
        data={listData}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <Text style={{ color: '#8A8A93', textAlign: 'center', marginTop: 24 }}>
            {tab === 'mine' ? 'Aún no has subido historias.' : 'Aún no tienes historias con “Me gusta”.'}
          </Text>
        }
        renderItem={({ item }) => (
          <ProfileStoryCard
            item={item}
            currentUserId={userId}
            avatarUrl={avatarUrl}
            isMine={tab === 'mine'}
            isLiked={likedIds.has(item.id)}
            onToggleLike={() => toggleLike(item)}
          />
        )}
        showsVerticalScrollIndicator={false}
      />

      {/* Sheet / mini notificación elegante */}
      <Modal
        visible={showSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSheet(false)}
      >
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View
              style={[
                s.iconWrap,
                sheet.variant === 'error'
                  ? { backgroundColor: '#3F1D1D', borderColor: '#7F1D1D' }
                  : { backgroundColor: '#1F2937', borderColor: '#374151' },
              ]}
            >
              <Ionicons
                name={sheet.variant === 'error' ? 'alert-circle' : 'information-circle'}
                size={24}
                color={sheet.variant === 'error' ? '#F87171' : '#93C5FD'}
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
    </View>
  );
}

function ProfileStoryCard({
  item,
  isMine,
  avatarUrl,
  currentUserId,
  isLiked,
  onToggleLike,
}: {
  item: DBStory;
  isMine: boolean;
  avatarUrl: string | null;
  currentUserId: string | null;
  isLiked: boolean;
  onToggleLike: () => void;
}) {
  const hasCover = !!item.cover_url;
  const authorForCard =
    item.author_name?.trim() || (item.profiles?.[0]?.display_name?.trim() || 'Autor');

  const shouldUseSelfAvatar = isMine || (currentUserId && item.author_id === currentUserId);
  const authorAvatar =
    shouldUseSelfAvatar ? avatarUrl : (item.profiles?.[0]?.avatar_url || null);

  return (
    <Link
      href={{
        pathname: '/story/[id]',
        params: {
          id: item.id,
          title: item.title,
          author: authorForCard,
          body: item.body,
          cover: item.cover_url ?? '',
          likes: String(item.likes_count ?? 0),
          comments: String(item.comments_count ?? 0),
          source: 'profile',
        },
      }}
      asChild
    >
      <TouchableOpacity activeOpacity={0.85} style={s.card}>
        <View style={s.headerRow}>
          {authorAvatar ? (
            <Image source={{ uri: authorAvatar }} style={s.avatarMini} />
          ) : (
            <View style={[s.avatarMini, { backgroundColor: '#0F1016' }]} />
          )}
          <Text style={s.authorTxt}>{authorForCard}</Text>
        </View>

        <Text style={s.cardTitle}>{item.title}</Text>

        {hasCover ? <Image source={{ uri: item.cover_url! }} style={s.cardImg} /> : null}

        {!hasCover ? (
          <Text style={s.excerpt} numberOfLines={3}>
            {item.body}
          </Text>
        ) : null}

        <View style={s.footerRow}>
          <TouchableOpacity onPress={onToggleLike} style={s.meta} hitSlop={10}>
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={16}
              color={isLiked ? '#EF4444' : '#F3F4F6'}
            />
            <Text style={[s.metaTxt, isLiked && { color: '#EF4444', fontWeight: '700' }]}>
              {item.likes_count ?? 0}
            </Text>
          </TouchableOpacity>

          <View style={[s.meta, { marginLeft: 12 }]}>
            <Ionicons name="chatbubble-outline" size={16} color="#F3F4F6" />
            <Text style={s.metaTxt}>{item.comments_count ?? 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0B0F' },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#0B0B0F',
  },
  editAvatarBtn: {
    position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#27272A',
  },
  name: { color: '#F3F4F6', fontSize: 24, fontWeight: '700', flex: 1 },

  tabs: { marginTop: 24, paddingHorizontal: 16, flexDirection: 'row', gap: 10 },
  tabBtn: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#27272A',
    backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center',
  },
  tabBtnActive: { backgroundColor: '#1F2937', borderColor: '#27272A' },
  tabTxt: { color: '#C9C9D1', fontWeight: '600' },
  tabTxtActive: { color: '#F3F4F6' },

  card: {
    backgroundColor: '#121219', borderRadius: 14, overflow: 'hidden', borderWidth: 1,
    borderColor: '#1F1F27', padding: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatarMini: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#0F1016',
    borderWidth: 1, borderColor: '#1F1F27',
  },
  authorTxt: { color: '#E5E7EB', fontWeight: '600' },
  cardTitle: { color: '#F3F4F6', fontWeight: '700', fontSize: 18, marginBottom: 8 },
  cardImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, marginBottom: 8 },
  excerpt: { color: '#D1D5DB' },
  footerRow: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#1F1F27', paddingTop: 8,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTxt: { color: '#F3F4F6' },

  // === Sheet styles (igual que en login) ===
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#121219',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#1F1F27',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: { 
    color: '#F3F4F6', 
    fontWeight: '700', 
    fontSize: 18, 
    textAlign: 'center' 
  },
  sheetMsg: { 
    color: '#D1D5DB', 
    textAlign: 'center', 
    marginTop: 6 
  },
  sheetActions: { 
    flexDirection: 'row', 
    gap: 10, 
    marginTop: 16, 
    justifyContent: 'center' 
  },
  sheetBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sheetBtnPrimary: { 
    backgroundColor: '#1F2937', 
    borderColor: '#27272A' 
  },
  sheetBtnText: { 
    fontWeight: '600', 
    color: '#fff' 
  },
});
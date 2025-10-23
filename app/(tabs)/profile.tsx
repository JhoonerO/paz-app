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
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Link, useNavigation, useRouter, useFocusEffect } from 'expo-router';
import { useFonts, Risque_400Regular } from '@expo-google-fonts/risque';
import { supabase } from '../../lib/supabase';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// 👇 AVATARES PREDETERMINADOS
const DEFAULT_AVATARS = [
  { id: 'ardilla', name: 'Ardilla', source: require('../../imagenes_de_Perfil/ardilla.jpg') },
  { id: 'caballo', name: 'Caballo', source: require('../../imagenes_de_Perfil/caballo.jpg') },
  { id: 'capibara', name: 'Capibara', source: require('../../imagenes_de_Perfil/capibara.jpg') },
  { id: 'cocodrilo', name: 'Babilla', source: require('../../imagenes_de_Perfil/cocodrilito.jpg') },
  { id: 'foca', name: 'Manatí', source: require('../../imagenes_de_Perfil/foca.jpg') },
  { id: 'murcielago', name: 'Murciélago', source: require('../../imagenes_de_Perfil/murcielago.jpg') },
  { id: 'paloma', name: 'Paloma', source: require('../../imagenes_de_Perfil/paloma.jpg') },
  { id: 'pollo', name: 'Gallina', source: require('../../imagenes_de_Perfil/pollo.jpg') },
  { id: 'rana', name: 'Rana', source: require('../../imagenes_de_Perfil/rana.jpg') },
  { id: 'tigre', name: 'Jaguar', source: require('../../imagenes_de_Perfil/tigre.jpg') },
];

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
  liked_at?: string;
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

  const [fontsLoaded] = useFonts({
    Risque_400Regular,
  });

  const [displayName, setDisplayName] = useState<string>('Usuario');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [likesPublic, setLikesPublic] = useState<boolean>(true);

  const [tab, setTab] = useState<'mine' | 'likes'>('mine');
  const [myStories, setMyStories] = useState<DBStory[]>([]);
  const [likedStories, setLikedStories] = useState<DBStory[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

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
  if (!fontsLoaded) return;

  navigation.setOptions({
    headerTitle: () => (
      <Text
        style={{
          fontFamily: 'Risque_400Regular',
          fontSize: 22,
          color: '#F3F4F6',
          letterSpacing: 1,
        }}
      >
        U-PAZ
      </Text>
    ),
    headerTitleAlign: 'center',
    headerLeft: () => (
  <TouchableOpacity
    onPress={() => router.push('/')}
    hitSlop={10}
    style={{ 
      paddingHorizontal: 16,
      paddingVertical: 8,
    }}
  >
    <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
  </TouchableOpacity>
),
    headerRight: () => (
      <TouchableOpacity
        onPress={() => router.push('/profile/settings')}
        style={{ marginRight: 12 }}
        hitSlop={10}
      >
        <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
          <MaterialCommunityIcons name="hexagon-outline" size={22} color="#ffffff" />
          <View
            style={{
              position: 'absolute',
              width: 8,
              height: 8,
              borderRadius: 4,
              borderWidth: 1.5,
              borderColor: '#ffffff',
              backgroundColor: 'transparent',
            }}
          />
        </View>
      </TouchableOpacity>
    ),
  });
}, [navigation, router, fontsLoaded]);

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

      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, likes_public')
        .eq('id', uid)
        .single<ProfileRow>();

      setDisplayName(prof?.display_name || 'Usuario');
      setAvatarUrl(prof?.avatar_url ?? null);
      setLikesPublic(prof?.likes_public ?? true);

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

        let likedWithAuthor: DBStory[] = (liked ?? []).map((story: any) => {
          if (!story.profiles || story.profiles.length === 0) {
            return {
              ...story,
              profiles: [{ display_name: story.author_name || 'Autor', avatar_url: null }],
            };
          }
          return story;
        });

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

            if (!current || current.avatar_url == null || current.display_name == null) {
              const display_name = current?.display_name ?? fromMap?.display_name ?? st.author_name ?? 'Autor';
              const avatar_url =
                (st.author_id === uid ? (prof?.avatar_url ?? null) : null) ??
                current?.avatar_url ??
                fromMap?.avatar_url ??
                null;

              return { ...st, profiles: [{ display_name, avatar_url }] };
            }
            return st;
          });
        }

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

  // 👇 MODIFICADO: Subir avatar predeterminado a Supabase
  async function selectDefaultAvatar(avatarId: string) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) return;

      // Buscar el avatar en el array
      const avatar = DEFAULT_AVATARS.find(a => a.id === avatarId);
      if (!avatar) return;

      // Convertir el require() a URI local usando expo-asset
      const asset = Asset.fromModule(avatar.source);
      await asset.downloadAsync();
      
      if (!asset.localUri) {
        showNotification('Error', 'No se pudo cargar la imagen.', 'error');
        return;
      }

      // Subir a Supabase como cualquier otra imagen
      const { ext, type } = getExtAndType(asset.localUri);
      const ab = await uriToArrayBuffer(asset.localUri);
      const path = `${uid}/avatar_${avatarId}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('covers')
        .upload(path, ab, { upsert: true, contentType: type, cacheControl: '3600' });
      
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
      const url = pub.publicUrl;

      const { error: profErr } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', uid);

      if (profErr) {
        showNotification('Error', 'No se pudo actualizar el avatar.', 'error');
        return;
      }

      setAvatarUrl(url);
      setShowAvatarPicker(false);
      showNotification('Listo', 'Tu foto de perfil ha sido actualizada.', 'info');
    } catch (e: any) {
      showNotification('Error', e?.message ?? 'No se pudo actualizar el avatar.', 'error');
    }
  }

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
      setShowAvatarPicker(false);
      showNotification('Listo', 'Tu foto de perfil ha sido actualizada.', 'info');
    } catch (e: any) {
      showNotification('Error', e?.message ?? 'No se pudo actualizar el avatar.', 'error');
    }
  }

  const toggleLike = useCallback(
    async (story: DBStory) => {
      if (!userId) return;
      const isLiked = likedIds.has(story.id);

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
      <View style={s.avatarRow}>
        <View style={s.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: '#0F1016' }]} />
          )}
          <TouchableOpacity style={s.editAvatarBtn} onPress={() => setShowAvatarPicker(true)} hitSlop={10}>
            <Ionicons name="camera-outline" size={16} color="#F3F4F6" />
          </TouchableOpacity>
        </View>
        <Text style={s.name}>{displayName}</Text>
      </View>

      <View style={s.tabs}>
        <View style={s.tabBtnContainer}>
          <TouchableOpacity 
            onPress={() => setTab('mine')} 
            style={[s.tabBtn, tab === 'mine' && s.tabBtnActive]}
          >
            <Text style={[s.tabTxt, tab === 'mine' && s.tabTxtActive]}>
              {`Mis Historias ${myStories.length}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setTab('likes')} 
            style={[s.tabBtn, tab === 'likes' && s.tabBtnActive, !likesPublic && { borderColor: '#363636ff' }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[s.tabTxt, tab === 'likes' && s.tabTxtActive]}>Me gusta</Text>
              {!likesPublic && <Ionicons name="lock-closed-outline" size={14} color="#9CA3AF" />}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <Text style={{ color: '#8A8A93', textAlign: 'center', marginTop: 24 }}>
            {tab === 'mine' ? 'Aún no has subido historias.' : 'Aún no tienes historias con "Me gusta".'}
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

      <Modal
        visible={showAvatarPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvatarPicker(false)}
      >
        <View style={s.overlay}>
          <View style={s.avatarPickerSheet}>
            <View style={s.avatarPickerHeader}>
              <Text style={s.avatarPickerTitle}>Elige tu avatar</Text>
              <TouchableOpacity onPress={() => setShowAvatarPicker(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#F3F4F6" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.avatarGrid} showsVerticalScrollIndicator={false}>
              {DEFAULT_AVATARS.map((avatar) => (
                <TouchableOpacity
                  key={avatar.id}
                  onPress={() => selectDefaultAvatar(avatar.id)}
                  style={s.avatarOption}
                  activeOpacity={0.7}
                >
                  <Image source={avatar.source} style={s.avatarOptionImg} />
                  <Text style={s.avatarOptionName}>{avatar.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={s.galleryBtn} onPress={onChangeAvatar}>
              <Ionicons name="images-outline" size={20} color="#F3F4F6" />
              <Text style={s.galleryBtnText}>Elegir de galería</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <Ionicons name="chatbox-outline" size={16} color='white' />
            <Text style={s.metaTxt}>{item.comments_count ?? 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Link>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000ff' },
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

tabs: { 
  marginTop: 24, 
  paddingHorizontal: 16,
  marginBottom: 16,
},

tabBtnContainer: {
  flexDirection: 'row',
  height: 40,
  borderRadius: 8,
  backgroundColor: '#000000ff',
  borderWidth: 2,
  borderColor: '#202020ff',
  width: '100%',
  maxWidth: 320,
  alignSelf: 'center',
  overflow: 'hidden',
},

tabBtn: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 8,
},

tabBtnActive: {
  backgroundColor: '#1f1f1fff',
},

tabTxt: {
  color: '#F3F4F6',
  fontWeight: '600',
  fontSize: 16,
},

tabTxtActive: {
  color: '#FFFFFF',
  fontWeight: '700',
},

  card: {
    backgroundColor: '#010102ff', borderRadius: 14, overflow: 'hidden', borderWidth: 1,
    borderColor: '#181818ff', padding: 12,
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
    borderTopWidth: 1, borderTopColor: '#010102ff', paddingTop: 8,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTxt: { color: '#F3F4F6' },

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

  avatarPickerSheet: {
    width: '100%',
    maxHeight: '75%',
    backgroundColor: '#121219',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#1F1F27',
  },
  avatarPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarPickerTitle: {
    color: '#F3F4F6',
    fontSize: 20,
    fontWeight: '700',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  avatarOption: {
    width: '30%',
    alignItems: 'center',
    gap: 8,
  },
  avatarOptionImg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#1F1F27',
  },
  avatarOptionName: {
    color: '#D1D5DB',
    fontSize: 12,
    textAlign: 'center',
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: '#27272A',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  galleryBtnText: {
    color: '#F3F4F6',
    fontSize: 16,
    fontWeight: '600',
  },
});

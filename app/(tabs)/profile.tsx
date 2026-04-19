// app/(tabs)/profile.tsx
import { useEffect, useLayoutEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Link, useNavigation, useRouter, useFocusEffect } from 'expo-router';
import { useFonts, Risque_400Regular } from '@expo-google-fonts/risque';
import { supabase } from '../../lib/supabase';
import { BadgeIcon } from '../profile/settings';
import { getStaticBadges, type StaticBadge } from '../../lib/badges';
import { checkAndUpdateStreak, getCurrentLevel } from '../../lib/gamification';
import { GestureHandlerRootView, PinchGestureHandler, TapGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import ShareStorySheet from '../../components/ShareStorySheet'; // ← NUEVO

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEFAULT_AVATARS = [
  { id: 'ardilla', name: 'Ardilla', source: require('../../imagenes_de_Perfil/ardilla.jpg'), publicPath: 'ardilla.jpg' },
  { id: 'caballo', name: 'Caballo', source: require('../../imagenes_de_Perfil/caballo.jpg'), publicPath: 'caballo.jpg' },
  { id: 'capibara', name: 'Capibara', source: require('../../imagenes_de_Perfil/capibara.jpg'), publicPath: 'capibara.jpg' },
  { id: 'cocodrilo', name: 'Babilla', source: require('../../imagenes_de_Perfil/cocodrilito.jpg'), publicPath: 'cocodrilito.jpg' },
  { id: 'foca', name: 'Manatí', source: require('../../imagenes_de_Perfil/foca.jpg'), publicPath: 'foca.jpg' },
  { id: 'murcielago', name: 'Murciélago', source: require('../../imagenes_de_Perfil/murcielago.jpg'), publicPath: 'murcielago.jpg' },
  { id: 'paloma', name: 'Paloma', source: require('../../imagenes_de_Perfil/paloma.jpg'), publicPath: 'paloma.jpg' },
  { id: 'pollo', name: 'Gallina', source: require('../../imagenes_de_Perfil/pollo.jpg'), publicPath: 'pollo.jpg' },
  { id: 'rana', name: 'Rana', source: require('../../imagenes_de_Perfil/rana.jpg'), publicPath: 'rana.jpg' },
  { id: 'tigre', name: 'Jaguar', source: require('../../imagenes_de_Perfil/tigre.jpg'), publicPath: 'tigre.jpg' },
];

type StoryCategory = 'mito' | 'leyenda' | 'urbana' | 'otra';

type DBStory = {
  id: string;
  title: string;
  body: string;
  cover_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_id: string;
  category: StoryCategory | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
    is_admin?: boolean;
    created_at?: string;
    user_gamification?: { xp: number }[] | null;
  }[] | null;
  liked_at?: string;
};

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
  likes_public: boolean;
  is_admin: boolean;
  created_at: string;
};

type LikeUser = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  userBadges?: any[];
};

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
  const ab = await res.arrayBuffer();
  return ab as ArrayBuffer;
}

const toArray = (p: any) => (Array.isArray(p) ? p : p ? [p] : []);

type ProfileBadge = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string | null;
  scope?: 'admin_only' | 'all_users' | 'custom';
};

// ── Config de categorías para el badge ───────────────────────────────────────

const CAT_CONFIG: Record<StoryCategory, { label: string; icon: string; color: string }> = {
  mito:    { label: 'Mito',    icon: 'lightning-bolt',      color: '#8B9DC3' },
  leyenda: { label: 'Leyenda', icon: 'map-legend',          color: '#A0B4B8' },
  urbana:  { label: 'Urbana',  icon: 'city-variant-outline', color: '#9CA3AF' },
  otra:    { label: 'Otra',    icon: 'help-rhombus-outline', color: '#B8A9C9' },
};

function CategoryBadge({ category }: { category: StoryCategory }) {
  const cfg = CAT_CONFIG[category];
  if (!cfg) return null;
  return (
    <View style={catStyles.badge}>
      <MaterialCommunityIcons name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={[catStyles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const catStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#242424',
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

// ── Skeleton ──────────────────────────────────────────────────────────────────
function usePulse() {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1
    );
  }, []);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

function ProfileHeaderSkeleton() {
  const style = usePulse();
  return (
    <Animated.View style={[sk.headerWrap, style]}>
      <View style={sk.avatar} />
      <View style={{ flex: 1, gap: 10 }}>
        <View style={sk.nameLine} />
        <View style={sk.subLine} />
      </View>
    </Animated.View>
  );
}

function TabsSkeleton() {
  const style = usePulse();
  return (
    <Animated.View style={[sk.tabsWrap, style]}>
      <View style={sk.tabBtn} />
      <View style={sk.tabBtn} />
    </Animated.View>
  );
}

function StoryCardSkeleton() {
  const style = usePulse();
  return (
    <Animated.View style={[sk.card, style]}>
      <View style={sk.cardHeader}>
        <View style={sk.cardAvatar} />
        <View style={sk.cardAuthorLine} />
      </View>
      <View style={sk.cardTitleLine} />
      <View style={sk.cardImage} />
      <View style={sk.cardFooter}>
        <View style={sk.cardFooterLine} />
      </View>
    </Animated.View>
  );
}

function ProfileSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ProfileHeaderSkeleton />
      <TabsSkeleton />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {[...Array(4)].map((_, i) => (
          <StoryCardSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────
export default function Profile() {
  const navigation = useNavigation();
  const router = useRouter();
  const [fontsLoaded] = useFonts({ Risque_400Regular });
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>('Usuario');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [likesPublic, setLikesPublic] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [createdAt, setCreatedAt] = useState<string>('');

  const [tab, setTab] = useState<'mine' | 'likes'>('mine');
  const [myStories, setMyStories] = useState<DBStory[]>([]);
  const [likedStories, setLikedStories] = useState<DBStory[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showAvatarZoom, setShowAvatarZoom] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [userBadges, setUserBadges] = useState<ProfileBadge[]>([]);
  const [selectedUserBadge, setSelectedUserBadge] = useState<ProfileBadge | null>(null);
  const [showBadgeInfo, setShowBadgeInfo] = useState(false);

  const [selectedStaticBadge, setSelectedStaticBadge] = useState<StaticBadge | null>(null);
  const [showStaticBadgeInfo, setShowStaticBadgeInfo] = useState(false);
  const [userXP, setUserXP] = useState(0);

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
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{
            fontFamily: 'Risque_400Regular',
            fontSize: width * 0.055,
            color: '#F3F4F6',
            letterSpacing: 0.2,
            minWidth: 80,
            textAlign: 'center',
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
          style={{ paddingHorizontal: 16, paddingVertical: 8 }}
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
            <View style={{
              position: 'absolute',
              width: 8, height: 8, borderRadius: 4,
              borderWidth: 1.5, borderColor: '#ffffff',
              backgroundColor: 'transparent',
            }} />
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
        .select('display_name, avatar_url, likes_public, is_admin, created_at')
        .eq('id', uid)
        .single<ProfileRow>();

      setDisplayName(prof?.display_name || 'Usuario');
      setAvatarUrl(prof?.avatar_url ?? null);
      setLikesPublic(prof?.likes_public ?? true);
      setIsAdmin(prof?.is_admin ?? false);
      setCreatedAt(prof?.created_at ?? '');

      // Streak + XP
      checkAndUpdateStreak(uid).catch(() => {});
      supabase
        .from('user_gamification')
        .select('xp')
        .eq('user_id', uid)
        .maybeSingle()
        .then(({ data: g }) => { if (g) setUserXP(g.xp ?? 0); });

      // Cargar insignias según scope
      const { data: badgeRows, error: badgeErr } = await supabase
        .from('badges')
        .select('id, name, description, color, icon, scope')
        .order('name', { ascending: true });

      const userIsAdmin = prof?.is_admin ?? false;
      const allBadgesList = (badgeRows || []) as ProfileBadge[];

      // Auto-asignadas por scope
      const scopeBadges = allBadgesList.filter(b => {
        if (b.scope === 'admin_only') return userIsAdmin;
        if (b.scope === 'all_users') return true;
        return false;
      });

      // Custom asignadas a este usuario
      try {
        const { data: customAssigned, error: customErr } = await supabase
          .from('user_badges')
          .select(`badges ( id, name, description, color, icon, scope )`)
          .eq('user_id', uid);
        if (!customErr && customAssigned) {
          const customBadges = customAssigned
            .map((r: any) => ({ ...r.badges, userBadgeId: r.id }))
            .filter((b: any) => b.scope === 'custom');
          setUserBadges([...scopeBadges, ...customBadges]);
        } else {
          setUserBadges(scopeBadges);
        }
      } catch {
        setUserBadges(scopeBadges);
      }

      const [{ data: mine, error: mineErr }, { data: myXPData }] = await Promise.all([
        supabase
          .from('stories')
          .select(`
            id, title, body, cover_url, likes_count, comments_count,
            created_at, author_id, category,
            profiles!stories_author_id_fkey ( display_name, avatar_url, is_admin, created_at )
          `)
          .eq('author_id', uid)
          .order('created_at', { ascending: false }),
        supabase.from('user_gamification').select('xp').eq('user_id', uid).maybeSingle(),
      ]);
      if (mineErr) throw mineErr;
      const myXP = myXPData?.xp ?? 0;

      const myStoriesWithAuthor = (mine ?? []).map((story: any) => {
        const profileArr = toArray(story.profiles);
        if (profileArr.length === 0) {
          return {
            ...story,
            profiles: [{ display_name: prof?.display_name || 'Tú', avatar_url: prof?.avatar_url ?? null, user_badges: [] }],
          };
        }
        return { ...story, profiles: profileArr };
      });

      // Cargar insignias de todos los autores de mis historias
      const myStoryAuthorIds = Array.from(new Set(mine?.map((s: any) => s.author_id)));
      const myBadgesMap = new Map<string, any[]>();
      if (myStoryAuthorIds.length) {
        const { data: assignedBadges } = await supabase
          .from('user_badges')
          .select(`user_id, badges ( id, name, description, color, icon, scope ), granted_at`)
          .in('user_id', myStoryAuthorIds)
          .order('granted_at', { ascending: true });
        if (assignedBadges) {
          assignedBadges.forEach((row: any) => {
            const uid = row.user_id;
            const badge = row.badges;
            if (badge) {
              const existing = myBadgesMap.get(uid) || [];
              existing.push({ ...badge, _assigned_at: row.granted_at });
              myBadgesMap.set(uid, existing);
            }
          });
        }
        // Scope badges
        const { data: scopeBadges } = await supabase
          .from('badges')
          .select('id, name, description, color, icon, scope')
          .order('name', { ascending: true });
        (scopeBadges || []).forEach((badge: any) => {
          if (badge.scope === 'all_users') {
            myStoryAuthorIds.forEach((aid) => {
              const existing = myBadgesMap.get(aid) || [];
              if (!existing.some((b: any) => b.id === badge.id)) {
                existing.push(badge);
                myBadgesMap.set(aid, existing);
              }
            });
          } else if (badge.scope === 'admin_only') {
            myStoryAuthorIds.forEach((aid) => {
              const profRow = (mine || []).find((s: any) => s.author_id === aid);
              if ((profRow as any)?.profiles?.[0]?.is_admin) {
                const existing = myBadgesMap.get(aid) || [];
                if (!existing.some((b: any) => b.id === badge.id)) {
                  existing.push(badge);
                  myBadgesMap.set(aid, existing);
                }
              }
            });
          }
        });
      }

      // Asignar insignias a las historias
      const myStoriesWithBadges = myStoriesWithAuthor.map((st: any) => {
        const authorId = st.author_id;
        const authorBadges = myBadgesMap.get(authorId) || [];
        const authorIsAdmin = st.profiles?.[0]?.is_admin ?? false;
        return {
          ...st,
          profiles: [{
            ...st.profiles?.[0],
            user_badges: authorBadges,
            is_admin: authorIsAdmin,
            user_gamification: [{ xp: myXP }],
          }],
        };
      });
      setMyStories(myStoriesWithBadges);

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
            id, title, body, cover_url, likes_count, comments_count,
            created_at, author_id, category,
            profiles!stories_author_id_fkey ( display_name, avatar_url, is_admin, created_at )
          `)
          .in('id', ids);
        if (likedErr) throw likedErr;

        let likedWithAuthor: DBStory[] = (liked ?? []).map((story: any) => {
          const profileArr = toArray(story.profiles);
          if (profileArr.length === 0) {
            return { ...story, profiles: [{ display_name: 'Autor', avatar_url: null }] };
          }
          return { ...story, profiles: profileArr };
        });

        const authorIds = Array.from(new Set(likedWithAuthor.map(s => s.author_id)));
        if (authorIds.length) {
          const { data: authorProfiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, is_admin, created_at')
            .in('id', authorIds);

          const pMap = new Map<string, { display_name: string | null; avatar_url: string | null; is_admin: boolean; created_at: string }>();
          (authorProfiles ?? []).forEach((p: any) => {
            pMap.set(p.id, { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null, is_admin: Boolean(p.is_admin), created_at: p.created_at ?? '' });
          });

          likedWithAuthor = likedWithAuthor.map(st => {
            const current = toArray(st.profiles)[0] ?? null;
            const fromMap = pMap.get(st.author_id) ?? null;
            if (!current || current.avatar_url == null || current.display_name == null) {
              const display_name = current?.display_name ?? fromMap?.display_name ?? 'Autor';
              const avatar_url =
                (st.author_id === uid ? prof?.avatar_url : undefined) ??
                current?.avatar_url ??
                fromMap?.avatar_url ??
                null;
              return { ...st, profiles: [{ display_name, avatar_url, is_admin: fromMap?.is_admin ?? false, created_at: fromMap?.created_at ?? '', user_gamification: current?.user_gamification }] };
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

        // Cargar insignias + XP de autores de historias con like
        const likedAuthorIds = Array.from(new Set(likedWithAuthor.map((s: any) => s.author_id)));
        const likedBadgesMap = new Map<string, any[]>();
        const likedXPMap = new Map<string, number>();
        if (likedAuthorIds.length) {
          const { data: likedXPRows } = await supabase
            .from('user_gamification').select('user_id, xp').in('user_id', likedAuthorIds);
          (likedXPRows ?? []).forEach((r: any) => likedXPMap.set(r.user_id, r.xp ?? 0));

          const { data: assignedBadges } = await supabase
            .from('user_badges')
            .select(`user_id, badges ( id, name, description, color, icon, scope ), granted_at`)
            .in('user_id', likedAuthorIds)
            .order('granted_at', { ascending: true });
          if (assignedBadges) {
            assignedBadges.forEach((row: any) => {
              const uid = row.user_id;
              const badge = row.badges;
              if (badge) {
                const existing = likedBadgesMap.get(uid) || [];
                existing.push({ ...badge, _assigned_at: row.granted_at });
                likedBadgesMap.set(uid, existing);
              }
            });
          }
          const { data: scopeBadges } = await supabase
            .from('badges')
            .select('id, name, description, color, icon, scope')
            .order('name', { ascending: true });
          (scopeBadges || []).forEach((badge: any) => {
            if (badge.scope === 'all_users') {
              likedAuthorIds.forEach((aid) => {
                const existing = likedBadgesMap.get(aid) || [];
                if (!existing.some((b: any) => b.id === badge.id)) {
                  existing.push(badge);
                  likedBadgesMap.set(aid, existing);
                }
              });
            } else if (badge.scope === 'admin_only') {
              likedAuthorIds.forEach((aid) => {
                const profRow = likedWithAuthor.find((s: any) => s.author_id === aid);
                if ((profRow as any)?.profiles?.[0]?.is_admin) {
                  const existing = likedBadgesMap.get(aid) || [];
                  if (!existing.some((b: any) => b.id === badge.id)) {
                    existing.push(badge);
                    likedBadgesMap.set(aid, existing);
                  }
                }
              });
            }
          });
        }

        const likedWithBadges = likedWithAuthor.map((st: any) => {
          const authorId = st.author_id;
          const authorBadges = likedBadgesMap.get(authorId) || [];
          return {
            ...st,
            profiles: [{
              ...st.profiles?.[0],
              user_badges: authorBadges,
              user_gamification: [{ xp: likedXPMap.get(authorId) ?? 0 }],
            }],
          };
        });
        setLikedStories(likedWithBadges);
      }
    } catch (e: any) {
      showNotification('Error', e?.message ?? 'No se pudo cargar tu perfil.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFromSupabase(); }, [loadFromSupabase]);

  useFocusEffect(
    useCallback(() => {
      loadFromSupabase();
    }, [loadFromSupabase])
  );

  async function selectDefaultAvatar(avatarId: string) {
    if (uploadingAvatar) return;
    try {
      setUploadingAvatar(true);
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) return;

      const avatar = DEFAULT_AVATARS.find(a => a.id === avatarId);
      if (!avatar) return;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(avatar.publicPath);
      const url = pub?.publicUrl ?? null;
      if (!url) throw new Error('No se pudo obtener la URL del avatar.');

      const { error: profErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
      if (profErr) throw profErr;

      setAvatarUrl(url);
      setShowAvatarPicker(false);
      showNotification('Listo', 'Tu foto de perfil ha sido actualizada.', 'info');
    } catch (e: any) {
      showNotification('Error', e?.message ?? 'No se pudo actualizar el avatar.', 'error');
    } finally {
      setUploadingAvatar(false);
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
    if (uploadingAvatar) return;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) return;

      const localUri = await pickImage();
      if (!localUri) return;

      setUploadingAvatar(true);

      const { ext, type } = getExtAndType(localUri);
      const ab = await uriToArrayBuffer(localUri);
      const path = `${uid}/avatar.jpg`;

      const { error: upErr } = await supabase.storage
        .from('covers')
        .upload(path, ab, { upsert: true, contentType: type, cacheControl: '1' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
      const url = `${pub.publicUrl}?cb=${Date.now()}`;

      const { error: profErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
      if (profErr) {
        showNotification('Error', 'No se pudo actualizar el avatar.', 'error');
        setUploadingAvatar(false);
        return;
      }

      setAvatarUrl(url);
      setShowAvatarPicker(false);
      setUploadingAvatar(false);
      showNotification('Listo', 'Tu foto de perfil ha sido actualizada.', 'info');
    } catch (e: any) {
      setUploadingAvatar(false);
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
          showNotification('Ups', 'No se pudo quitar tu like.', 'error');
        }
      } else {
        const { error } = await supabase
          .from('story_likes')
          .insert({ user_id: userId, story_id: story.id });
        if (error) {
          setLikedIds(prev => { const next = new Set(prev); next.delete(story.id); return next; });
          showNotification('Ups', 'No se pudo registrar tu like.', 'error');
        }
      }
    },
    [userId, likedIds, tab]
  );

  const listData = useMemo(() => (tab === 'mine' ? myStories : likedStories), [tab, myStories, likedStories]);
  const isEarlyUser = new Date(createdAt) < new Date('2026-01-01');

  if (loading) return <ProfileSkeleton />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={s.screen}>
        <View style={s.avatarRow}>
          <View style={s.avatarWrap}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => avatarUrl && setShowAvatarZoom(true)}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, { backgroundColor: '#0F1016' }]} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.editAvatarBtn} onPress={() => setShowAvatarPicker(true)} hitSlop={10}>
              <Ionicons name="camera-outline" size={16} color="#F3F4F6" />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.name}>{displayName}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {getStaticBadges(isAdmin, createdAt).map((badge) => (
                <TouchableOpacity
                  key={badge.id}
                  onPress={() => { setSelectedStaticBadge(badge); setShowStaticBadgeInfo(true); }}
                  hitSlop={6}
                >
                  <BadgeIcon iconKey={badge.icon} size={22} color={badge.color} />
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => router.push('/profile/gamification')} hitSlop={6}>
                <MaterialCommunityIcons
                  name={getCurrentLevel(userXP).icon as any}
                  size={22}
                  color={getCurrentLevel(userXP).color}
                />
              </TouchableOpacity>
            </View>
          </View>
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
              style={[s.tabBtn, tab === 'likes' && s.tabBtnActive]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[s.tabTxt, tab === 'likes' && s.tabTxtActive]}>Me gusta</Text>
                {!likesPublic && <Ionicons name="lock-closed-outline" size={14} color="#9CA3AF" />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/profile/gamification')}
              style={s.trophyTab}
            >
              <MaterialCommunityIcons
                name={getCurrentLevel(userXP).icon as any}
                size={18}
                color={getCurrentLevel(userXP).color}
              />
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

        {/* Modales del perfil */}
        <Modal visible={showBadgeInfo} transparent animationType="fade" onRequestClose={() => setShowBadgeInfo(false)}>
          <View style={s.badgeOverlay}>
            <TouchableOpacity style={s.badgeBackdrop} onPress={() => setShowBadgeInfo(false)} />
            <View style={s.badgeContent}>
              <TouchableOpacity style={s.badgeCloseBtn} onPress={() => setShowBadgeInfo(false)}>
                <Ionicons name="close-circle" size={28} color="#F3F4F6" />
              </TouchableOpacity>
              {selectedUserBadge && (
                <View style={s.badgeInfo}>
                  <BadgeIcon iconKey={selectedUserBadge.icon || 'verified_MI_0'} size={56} color={selectedUserBadge.color} />
                  <Text style={s.badgeTitle}>{selectedUserBadge.name}</Text>
                  <Text style={s.badgeDesc}>{selectedUserBadge.description}</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={showStaticBadgeInfo} transparent animationType="fade" onRequestClose={() => setShowStaticBadgeInfo(false)}>
          <View style={s.badgeOverlay}>
            <TouchableOpacity style={s.badgeBackdrop} onPress={() => setShowStaticBadgeInfo(false)} />
            <View style={s.badgeContent}>
              <TouchableOpacity style={s.badgeCloseBtn} onPress={() => setShowStaticBadgeInfo(false)}>
                <Ionicons name="close-circle" size={28} color="#F3F4F6" />
              </TouchableOpacity>
              {selectedStaticBadge && (
                <View style={s.badgeInfo}>
                  <BadgeIcon iconKey={selectedStaticBadge.icon} size={56} color={selectedStaticBadge.color} />
                  <Text style={s.badgeTitle}>{selectedStaticBadge.name}</Text>
                  <Text style={s.badgeDesc}>{selectedStaticBadge.description}</Text>
                </View>
              )}
            </View>
          </View>
        </Modal>

        <ImageZoomModal
          visible={showAvatarZoom}
          imageUri={avatarUrl || ''}
          onClose={() => setShowAvatarZoom(false)}
        />

        <Modal visible={uploadingAvatar} transparent animationType="fade">
          <View style={s.loadingOverlay}>
            <View style={s.loadingBox}>
              <ActivityIndicator size="large" color="#32B8C6" />
              <Text style={s.loadingText}>Cambiando foto...</Text>
              <Text style={s.loadingSubtext}>Por favor espera</Text>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showAvatarPicker}
          transparent
          animationType="slide"
          onRequestClose={() => !uploadingAvatar && setShowAvatarPicker(false)}
        >
          <View style={s.overlay}>
            <View style={s.avatarPickerSheet}>
              <View style={s.avatarPickerHeader}>
                <Text style={s.avatarPickerTitle}>Elige tu avatar</Text>
                <TouchableOpacity onPress={() => setShowAvatarPicker(false)} hitSlop={10} disabled={uploadingAvatar}>
                  <Ionicons name="close" size={24} color={uploadingAvatar ? '#666' : '#F3F4F6'} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={s.avatarGrid} showsVerticalScrollIndicator={false}>
                {DEFAULT_AVATARS.map((avatar) => (
                  <TouchableOpacity
                    key={avatar.id}
                    onPress={() => selectDefaultAvatar(avatar.id)}
                    style={s.avatarOption}
                    activeOpacity={0.7}
                    disabled={uploadingAvatar}
                  >
                    <Image source={avatar.source} style={[s.avatarOptionImg, uploadingAvatar && { opacity: 0.5 }]} />
                    <Text style={[s.avatarOptionName, uploadingAvatar && { opacity: 0.5 }]}>{avatar.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[s.galleryBtn, uploadingAvatar && { opacity: 0.5 }]}
                onPress={onChangeAvatar}
                disabled={uploadingAvatar}
              >
                <Ionicons name="images-outline" size={20} color="#F3F4F6" />
                <Text style={s.galleryBtnText}>Elegir de galería</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showSheet} transparent animationType="fade" onRequestClose={() => setShowSheet(false)}>
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={[
                s.iconWrap,
                sheet.variant === 'error'
                  ? { backgroundColor: '#3F1D1D', borderColor: '#7F1D1D' }
                  : { backgroundColor: '#1F2937', borderColor: '#374151' },
              ]}>
                <Ionicons
                  name={sheet.variant === 'error' ? 'alert-circle' : 'information-circle'}
                  size={24}
                  color={sheet.variant === 'error' ? '#F87171' : '#93C5FD'}
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
      </View>
    </GestureHandlerRootView>
  );
}

// ── ImageZoomModal ─────────────────────────────────────────────────────────────
function ImageZoomModal({
  visible, imageUri, onClose,
}: {
  visible: boolean; imageUri: string; onClose: () => void;
}) {
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const doubleTapRef = useCallback((ref: any) => ref, []);

  const onDoubleTap = (event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      if (scale.value > 1) {
        scale.value = withSpring(1); baseScale.value = 1;
        translateX.value = withSpring(0); translateY.value = withSpring(0);
      } else {
        scale.value = withSpring(2); baseScale.value = 2;
      }
    }
  };

  const onPinch = (event: any) => { scale.value = baseScale.value * event.nativeEvent.scale; };

  const onPinchEnd = () => {
    baseScale.value = scale.value;
    if (scale.value < 1) {
      scale.value = withSpring(1); baseScale.value = 1;
      translateX.value = withSpring(0); translateY.value = withSpring(0);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    borderRadius: scale.value === 1 ? (SCREEN_WIDTH * 0.9) / 2 : 0,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={s.zoomOverlay} activeOpacity={1} onPress={onClose}>
        <TapGestureHandler ref={doubleTapRef} onHandlerStateChange={onDoubleTap} numberOfTaps={2}>
          <Animated.View style={{ justifyContent: 'center', alignItems: 'center' }}>
            <PinchGestureHandler onGestureEvent={onPinch} onEnded={onPinchEnd}>
              <Animated.View style={animatedStyle}>
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                  <Image source={{ uri: imageUri }} style={s.zoomImage} resizeMode="cover" />
                </TouchableOpacity>
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </TapGestureHandler>
      </TouchableOpacity>
    </Modal>
  );
}

// ── ProfileStoryCard ───────────────────────────────────────────────────────────
function ProfileStoryCard({
  item, isMine, avatarUrl, currentUserId, isLiked, onToggleLike,
}: {
  item: DBStory;
  isMine: boolean;
  avatarUrl: string | null;
  currentUserId: string | null;
  isLiked: boolean;
  onToggleLike: () => void;
}) {
  const hasCover = !!item.cover_url;
  const profileArr = toArray(item.profiles);
  const authorForCard = profileArr[0]?.display_name?.trim() || 'Autor';
  const shouldUseSelfAvatar = isMine || (currentUserId && item.author_id === currentUserId);
  const authorAvatar = shouldUseSelfAvatar ? avatarUrl : (profileArr[0]?.avatar_url || null);
  const authorIsAdmin = profileArr[0]?.is_admin ?? false;
  const authorCreatedAt = profileArr[0]?.created_at ?? '';
  const authorXP = profileArr[0]?.user_gamification?.[0]?.xp ?? 0;

  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likeUsers, setLikeUsers] = useState<LikeUser[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showShare, setShowShare] = useState(false); // ← NUEVO

  const handleShowLikes = async () => {
    setShowLikesModal(true);
    setLoadingLikes(true);
    try {
      const { data: likes, error } = await supabase
        .from('story_likes')
        .select(`
          user_id,
          profiles!story_likes_user_id_fkey ( id, display_name, avatar_url, is_admin, created_at )
        `)
        .eq('story_id', item.id);
      if (error) throw error;

      const userIds = (likes ?? []).map((l: any) => l.user_id);
      const profileMap = new Map((likes ?? []).map((l: any) => [l.profiles?.id, l.profiles]));
      const badgesMap = new Map<string, any[]>();

      // Cargar insignias asignadas
      const { data: assignedBadges } = await supabase
        .from('user_badges')
        .select(`user_id, badges ( id, name, description, color, icon, scope ), granted_at`)
        .in('user_id', userIds)
        .order('granted_at', { ascending: true });
      if (assignedBadges) {
        assignedBadges.forEach((row: any) => {
          const uid = row.user_id;
          const badge = row.badges;
          if (badge) {
            const existing = badgesMap.get(uid) || [];
            existing.push({ ...badge, _assigned_at: row.granted_at });
            badgesMap.set(uid, existing);
          }
        });
      }

      // Cargar badges de scope
      const { data: scopeBadges } = await supabase
        .from('badges')
        .select('id, name, description, color, icon, scope')
        .order('name', { ascending: true });
      (scopeBadges || []).forEach((badge: any) => {
        if (badge.scope === 'all_users') {
          userIds.forEach((uid) => {
            const existing = badgesMap.get(uid) || [];
            if (!existing.some((b: any) => b.id === badge.id)) {
              existing.push(badge);
              badgesMap.set(uid, existing);
            }
          });
        } else if (badge.scope === 'admin_only') {
          userIds.forEach((uid) => {
            const profile = profileMap.get(uid);
            if (profile?.is_admin) {
              const existing = badgesMap.get(uid) || [];
              if (!existing.some((b: any) => b.id === badge.id)) {
                existing.push(badge);
                badgesMap.set(uid, existing);
              }
            }
          });
        }
      });

      const users: LikeUser[] = (likes ?? []).map((like: any) => ({
        id: like.profiles.id,
        display_name: like.profiles.display_name,
        avatar_url: like.profiles.avatar_url,
        is_admin: like.profiles.is_admin,
        created_at: like.profiles.created_at,
        userBadges: badgesMap.get(like.user_id) || [],
      }));
      setLikeUsers(users);
    } catch (e: any) {
      console.error('Error cargando likes:', e);
    } finally {
      setLoadingLikes(false);
    }
  };

  const handleLikePress = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try { await onToggleLike(); } finally { setIsLiking(false); }
  };

  const likesCount = item.likes_count ?? 0;
  const commentsCount = item.comments_count ?? 0;

  return (
    <>
      <Link
        href={{
          pathname: '/story/[id]',
          params: {
            id: item.id, title: item.title, author: authorForCard,
            body: item.body, cover: item.cover_url ?? '',
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
              <Text style={s.authorTxt}>{authorForCard}</Text>
              {getStaticBadges(authorIsAdmin, authorCreatedAt).map((b) => (
                <BadgeIcon key={b.id} iconKey={b.icon} size={13} color={b.color} />
              ))}
              <MaterialCommunityIcons name={getCurrentLevel(authorXP).icon as any} size={13} color={getCurrentLevel(authorXP).color} />
            </View>
            {item.category && <CategoryBadge category={item.category} />}
          </View>

          <Text style={s.cardTitle}>{item.title}</Text>
          {hasCover ? <Image source={{ uri: item.cover_url! }} style={s.cardImg} /> : null}
          {!hasCover ? <Text style={s.excerpt} numberOfLines={3}>{item.body}</Text> : null}

          <View style={s.footerRow}>
            {/* Like */}
            <TouchableOpacity onPress={handleLikePress} style={s.meta} hitSlop={10} disabled={isLiking}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'} size={16}
                color={isLiked ? '#EF4444' : '#F3F4F6'}
                style={{ opacity: isLiking ? 0.5 : 1 }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleShowLikes} activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginLeft: 4 }}
            >
              <Text style={[s.metaTxt, isLiked && { color: '#EF4444', fontWeight: '700' }]}>
                {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
              </Text>
            </TouchableOpacity>

            {/* Comentarios */}
            <View style={[s.meta, { marginLeft: 12 }]}>
              <Ionicons name="chatbox-outline" size={16} color="white" />
            </View>
            <View style={{ marginLeft: 4 }}>
              <Text style={s.metaTxt}>
                {commentsCount} {commentsCount === 1 ? 'Comentario' : 'Comentarios'}
              </Text>
            </View>

            {/* ← NUEVO: Compartir */}
            <TouchableOpacity
              style={{ marginLeft: 'auto' }}
              onPress={(e) => { e.stopPropagation(); setShowShare(true); }}
              hitSlop={10}
              activeOpacity={0.8}
            >
              <Ionicons name="share-social-outline" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Link>

      {/* Modal likes */}
      <Modal visible={showLikesModal} transparent animationType="fade">
        <View style={s.likesOverlay}>
          <TouchableOpacity style={s.likeBackdrop} onPress={() => setShowLikesModal(false)} />
          <View style={s.likesSheet}>
            <View style={s.likesHeader}>
              <Text style={s.likesTitle}>Les dio like</Text>
              <TouchableOpacity onPress={() => setShowLikesModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color="#F3F4F6" />
              </TouchableOpacity>
            </View>
            {loadingLikes ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#F3F4F6" />
              </View>
            ) : likeUsers.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#9CA3AF' }}>Sin likes aún</Text>
              </View>
            ) : (
              <FlatList
                data={likeUsers}
                keyExtractor={(it) => it.id}
                contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item: user }) => {
                  const isUserEarly = new Date(user.created_at) < new Date('2026-01-01');
                  return (
                    <Link href={{ pathname: '/profile/[id]', params: { id: user.id } }} asChild>
                      <TouchableOpacity style={s.likeUserCard} onPress={() => setShowLikesModal(false)}>
                        {user.avatar_url ? (
                          <Image source={{ uri: user.avatar_url }} style={s.likeUserAvatar} />
                        ) : (
                          <View style={[s.likeUserAvatar, { backgroundColor: '#0F1016', alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="person-outline" size={16} color="#9CA3AF" />
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                          <Text style={s.likeUserName}>{user.display_name || 'Usuario'}</Text>
                          {getStaticBadges(user.is_admin, user.created_at).map((b) => (
                            <BadgeIcon key={b.id} iconKey={b.icon} size={14} color={b.color} />
                          ))}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
                      </TouchableOpacity>
                    </Link>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ← NUEVO: ShareStorySheet */}
      {currentUserId && (
        <ShareStorySheet
          visible={showShare}
          onClose={() => setShowShare(false)}
          currentUserId={currentUserId}
          story={{
            id: item.id,
            title: item.title,
            cover_url: item.cover_url,
            author: authorForCard,
            author_avatar: authorAvatar,
          }}
        />
      )}
    </>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000ff' },
  avatarRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, marginTop: 24, gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#0B0B0F' },
  editAvatarBtn: {
    position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#27272A',
  },
  name: { color: '#F3F4F6', fontSize: 28, fontWeight: '700' },
  badgeOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  badgeBackdrop: { position: 'absolute', width: '100%', height: '100%' },
  badgeContent: {
    backgroundColor: '#121219', borderRadius: 20, padding: 24,
    width: '85%', maxWidth: 320, borderWidth: 1, borderColor: '#1F1F27',
    alignItems: 'center', zIndex: 10,
  },
  badgeCloseBtn: { position: 'absolute', top: 12, right: 12, zIndex: 20 },
  badgeInfo: { alignItems: 'center', marginTop: 8 },
  badgeTitle: { color: '#F3F4F6', fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  badgeDesc: { color: '#D1D5DB', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  tabs: { marginTop: 24, paddingHorizontal: 16, marginBottom: 16 },
  tabBtnContainer: {
    flexDirection: 'row', height: 40, borderRadius: 8,
    backgroundColor: '#000000ff', borderWidth: 2, borderColor: '#202020ff',
    width: '100%', overflow: 'hidden',
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tabBtnActive: { backgroundColor: '#1f1f1fff' },
  trophyTab: {
    width: 44, alignItems: 'center', justifyContent: 'center',
    borderLeftWidth: 1, borderLeftColor: '#202020ff',
  },
  tabTxt: { color: '#F3F4F6', fontWeight: '600', fontSize: 14 },
  tabTxtActive: { color: '#FFFFFF', fontWeight: '700' },
  card: {
    backgroundColor: '#010102ff', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#181818ff', padding: 12,
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
  metaTxt: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#010102ff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, borderWidth: 1, borderColor: '#181818ff', alignItems: 'center',
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginBottom: 12,
  },
  sheetTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  sheetMsg: { color: '#D1D5DB', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  sheetActions: { width: '100%', gap: 8 },
  sheetBtn: { height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sheetBtnPrimary: { backgroundColor: '#1F2937' },
  sheetBtnText: { color: '#F3F4F6', fontWeight: '600' },
  avatarPickerSheet: {
    backgroundColor: '#010102ff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16, maxHeight: '80%', borderWidth: 1, borderColor: '#181818ff',
  },
  avatarPickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  avatarPickerTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '700' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingBottom: 16 },
  avatarOption: { alignItems: 'center', width: 80 },
  avatarOptionImg: { width: 72, height: 72, borderRadius: 36, marginBottom: 6 },
  avatarOptionName: { color: '#D1D5DB', fontSize: 12, textAlign: 'center' },
  galleryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#1F2937', borderRadius: 10,
    paddingVertical: 12, marginTop: 8,
  },
  galleryBtnText: { color: '#F3F4F6', fontWeight: '600' },
  loadingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  loadingBox: {
    backgroundColor: '#010102ff', borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: '#181818ff', gap: 12,
  },
  loadingText: { color: '#F3F4F6', fontSize: 18, fontWeight: '700' },
  loadingSubtext: { color: '#9CA3AF', fontSize: 14 },
  zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  zoomImage: { width: SCREEN_WIDTH * 0.9, height: SCREEN_WIDTH * 0.9, borderRadius: (SCREEN_WIDTH * 0.9) / 2 },
  likesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  likeBackdrop: { position: 'absolute', width: '100%', height: '100%' },
  likesSheet: {
    backgroundColor: '#010102ff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: '#181818ff', maxHeight: '75%', zIndex: 10,
  },
  likesHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#181818ff',
  },
  likesTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '700' },
  likeUserCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#010102ff',
    borderRadius: 12, borderWidth: 1, borderColor: '#181818ff', padding: 12, gap: 12,
  },
  likeUserAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#2C2C33' },
  likeUserName: { color: '#F3F4F6', fontWeight: '600' },
});

// ── Skeleton styles ───────────────────────────────────────────────────────────
const sk = StyleSheet.create({
  headerWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginTop: 24, gap: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#1a1a1aff' },
  nameLine: { height: 22, width: '60%', borderRadius: 8, backgroundColor: '#1a1a1aff' },
  subLine: { height: 14, width: '30%', borderRadius: 6, backgroundColor: '#1a1a1aff' },
  tabsWrap: { flexDirection: 'row', marginTop: 24, paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  tabBtn: { flex: 1, height: 40, borderRadius: 8, backgroundColor: '#1a1a1aff' },
  card: {
    backgroundColor: '#0d0d0dff', borderRadius: 14,
    borderWidth: 1, borderColor: '#181818ff', padding: 12, gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#1a1a1aff' },
  cardAuthorLine: { height: 12, width: '35%', borderRadius: 6, backgroundColor: '#1a1a1aff' },
  cardTitleLine: { height: 18, width: '70%', borderRadius: 6, backgroundColor: '#1a1a1aff' },
  cardImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: '#1a1a1aff' },
  cardFooter: { paddingTop: 8, borderTopWidth: 1, borderTopColor: '#181818ff' },
  cardFooterLine: { height: 12, width: '40%', borderRadius: 6, backgroundColor: '#1a1a1aff' },
});

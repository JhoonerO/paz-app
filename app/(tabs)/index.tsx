// app/(tabs)/index.tsx
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Link, useFocusEffect, useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { like, unlike } from '../../lib/likes';
import ShareStorySheet from '../../components/ShareStorySheet';
import { BadgeIcon } from '../profile/settings';
import { getStaticBadges } from '../../lib/badges';
import { awardLikeXP, getCurrentLevel } from '../../lib/gamification';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type StoryCategory = 'mito' | 'leyenda' | 'urbana' | 'otra';  // ← NUEVO

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
    avatar_url: string | null;
    is_admin: boolean;
    created_at: string;
    display_name: string | null;
    user_gamification?: { xp: number }[] | null;
    user_badges?: {
      badges: {
        id: string;
        name: string;
        description: string;
        color: string;
        icon: string | null;
      };
    }[];
  }[] | null;
};

type LikeUser = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  userBadges?: any[];
};

const C = {
  bg: '#000000ff',
  card: '#010102ff',
  cardBorder: '#181818ff',
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A1AA',
  line: '#000000ff',
  avatarBg: '#0F1016',
  avatarBorder: '#2C2C33',
  like: '#ef4444',
};

// ── Config de categorías para el badge ───────────────────────────────────────

const CAT_CONFIG: Record<StoryCategory, { label: string; icon: string; color: string }> = {
  mito:    { label: 'Mito',    icon: 'lightning-bolt',      color: '#A78BFA' },
  leyenda: { label: 'Leyenda', icon: 'map-legend',          color: '#6EE7B7' },
  urbana:  { label: 'Urbana',  icon: 'city-variant-outline', color: '#94A3B8' },
  otra:    { label: 'Otra',    icon: 'help-rhombus-outline', color: '#94A3B8' },
};

// Badge inline — solo ícono + label, sin colores de fondo llamativos
function CategoryBadge({ category }: { category: StoryCategory }) {
  const cfg = CAT_CONFIG[category];
  if (!cfg) return null;
  return (
    <View style={b.badge}>
      <MaterialCommunityIcons name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={[b.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const b = StyleSheet.create({
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

// ─────────────────────────────────────────────────────────────────────────────

const toArray = (p: any) => (Array.isArray(p) ? p : p ? [p] : []);

// ─── Skeleton (sin cambios) ───────────────────────────────────────────────────
function SkeletonBox({
  width, height, borderRadius = 8, style,
}: {
  width: number | string; height: number; borderRadius?: number; style?: any;
}) {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.9, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1, true
    );
    return () => cancelAnimation(opacity);
  }, []);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[animStyle, { width: width as any, height, borderRadius, backgroundColor: '#1A1A22' }, style]}
    />
  );
}

function SkeletonCard() {
  return (
    <View style={{
      backgroundColor: C.card, borderRadius: 16,
      borderWidth: 1, borderColor: C.cardBorder, padding: 12, gap: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <SkeletonBox width={28} height={28} borderRadius={14} />
        <SkeletonBox width={100} height={12} borderRadius={6} />
      </View>
      <SkeletonBox width="70%" height={16} borderRadius={6} />
      <SkeletonBox width="100%" height={160} borderRadius={12} />
      <SkeletonBox width="100%" height={12} borderRadius={6} />
      <SkeletonBox width="85%" height={12} borderRadius={6} />
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
        <SkeletonBox width={60} height={12} borderRadius={6} />
        <SkeletonBox width={80} height={12} borderRadius={6} />
      </View>
    </View>
  );
}

function FeedSkeleton() {
  const fadeIn = useSharedValue(0);
  useEffect(() => { fadeIn.value = withTiming(1, { duration: 260 }); }, []);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeIn.value }));
  return (
    <Animated.View style={[fadeStyle, { padding: 16, gap: 14 }]}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </Animated.View>
  );
}

// ─── Feed principal ───────────────────────────────────────────────────────────
export default function Feed() {
  const [stories, setStories] = useState<DBStory[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isLoadedRef = useRef(false);
  const flatListRef = useRef<FlatList<DBStory>>(null);

  type TabsNav = BottomTabNavigationProp<any>;
  const navigation = useNavigation<TabsNav>();

  const contentOpacity = useSharedValue(0);
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  useEffect(() => {
    if (!loading) {
      contentOpacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.ease) });
    }
  }, [loading]);

  async function loadFeed() {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);

    if (uid) {
      const { data: me } = await supabase
        .from('profiles').select('avatar_url').eq('id', uid)
        .single<{ avatar_url: string | null }>();
      setUserAvatar(me?.avatar_url ?? null);
    } else {
      setUserAvatar(null);
    }

    const { data: rows, error } = await supabase
      .from('stories')
      .select(`
        id, title, body, cover_url, likes_count, comments_count,
        created_at, author_id, category,
        profiles!stories_author_id_fkey ( avatar_url, is_admin, created_at, display_name, user_gamification ( xp ) )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn(error.message);
      setStories([]);
      setLikedSet(new Set());
      isLoadedRef.current = true;
      setLoading(false);
      return;
    }

    const rawStories = (rows ?? []) as any[];
    const authorIds = Array.from(new Set(rawStories.map((s) => s.author_id)));
    const avatarMap = new Map<string, string | null>();
    const displayNameMap = new Map<string, string | null>();
    const badgesMap = new Map<string, any[]>();

    // Cargar perfiles de autores
    const xpMap = new Map<string, number>();
    if (authorIds.length) {
      const [{ data: profRows }, { data: xpRows }] = await Promise.all([
        supabase.from('profiles').select('id, avatar_url, display_name, is_admin').in('id', authorIds),
        supabase.from('user_gamification').select('user_id, xp').in('user_id', authorIds),
      ]);
      (profRows ?? []).forEach((p: any) => {
        avatarMap.set(p.id, p.avatar_url ?? null);
        displayNameMap.set(p.id, p.display_name ?? null);
      });
      (xpRows ?? []).forEach((r: any) => xpMap.set(r.user_id, r.xp ?? 0));

      // Cargar TODAS las insignias asignadas desde user_badges
      const { data: assignedBadges, error: badgeErr } = await supabase
        .from('user_badges')
        .select(`user_id, badges ( id, name, description, color, icon, scope ), granted_at`)
        .in('user_id', authorIds)
        .order('granted_at', { ascending: true });

      if (!badgeErr && assignedBadges) {
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

      // Cargar badges de scope (all_users, admin_only) que NO están en user_badges
      const { data: scopeBadges } = await supabase
        .from('badges')
        .select('id, name, description, color, icon, scope')
        .order('name', { ascending: true });

      (scopeBadges || []).forEach((badge: any) => {
        if (badge.scope === 'all_users') {
          authorIds.forEach((aid) => {
            const existing = badgesMap.get(aid) || [];
            const yaExiste = existing.some((b: any) => b.id === badge.id);
            if (!yaExiste) {
              existing.push(badge);
              badgesMap.set(aid, existing);
            }
          });
        } else if (badge.scope === 'admin_only') {
          authorIds.forEach((aid) => {
            const isAuthorAdmin = profRows?.find((p: any) => p.id === aid)?.is_admin;
            if (isAuthorAdmin) {
              const existing = badgesMap.get(aid) || [];
              const yaExiste = existing.some((b: any) => b.id === badge.id);
              if (!yaExiste) {
                existing.push(badge);
                badgesMap.set(aid, existing);
              }
            }
          });
        }
      });
    }

    // Normalizar historias con insignias
    const normalized: DBStory[] = rawStories.map((st) => {
      const profileArr = toArray(st.profiles);
      const profile0 = profileArr[0] ?? null;
      const authorId = st.author_id;
      const authorIsAdmin = profile0?.is_admin ?? false;
      const avatar =
        profile0?.avatar_url ??
        (uid && authorId === uid ? userAvatar : null) ??
        avatarMap.get(authorId) ?? null;
      const display_name =
        profile0?.display_name ?? displayNameMap.get(authorId) ?? null;

      // Obtener TODAS las insignias de ESTE autor desde el mapa
      const authorBadges = badgesMap.get(authorId) || [];

      return {
        ...st,
        profiles: [{
          avatar_url: avatar,
          is_admin: authorIsAdmin,
          created_at: profile0?.created_at ?? '',
          display_name,
          user_badges: authorBadges,
          user_gamification: [{ xp: xpMap.get(authorId) ?? 0 }],
        }],
      };
    });

    setStories(normalized);

    if (uid && normalized.length) {
      const ids = normalized.map((r) => r.id);
      const { data: likeRows, error: likeErr } = await supabase
        .from('story_likes').select('story_id').eq('user_id', uid).in('story_id', ids);
      if (!likeErr && likeRows) {
        setLikedSet(new Set(likeRows.map((r) => r.story_id as string)));
      } else {
        setLikedSet(new Set());
      }
    } else {
      setLikedSet(new Set());
    }

    isLoadedRef.current = true;
    setLoading(false);
  }

  useEffect(() => {
    if (!isLoadedRef.current) loadFeed();
  }, []);

  useFocusEffect(useCallback(() => {}, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    isLoadedRef.current = false;
    await loadFeed();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e: any) => {
      if (navigation.isFocused()) {
        e.preventDefault?.();
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <View style={s.screen}>
      {loading ? (
        <FeedSkeleton />
      ) : (
        <Animated.View style={[{ flex: 1 }, contentStyle]}>
          <FlatList
            ref={flatListRef}
            data={stories}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textPrimary} />
            }
            renderItem={({ item }) => (
              <StoryCard
                item={item}
                liked={likedSet.has(item.id)}
                userId={userId}
                onToggleLike={async (id) => {
                  const { data: userData } = await supabase.auth.getUser();
                  const uid = userData.user?.id;
                  if (!uid) return;
                  const isLiked = likedSet.has(id);
                  try {
                    if (isLiked) {
                      await unlike(id);
                      setLikedSet((prev) => { const next = new Set(prev); next.delete(id); return next; });
                      setStories((prev) => prev.map((st) =>
                        st.id === id ? { ...st, likes_count: Math.max(0, (st.likes_count || 0) - 1) } : st
                      ));
                    } else {
                      await like(id);
                      setLikedSet((prev) => new Set(prev).add(id));
                      setStories((prev) => prev.map((st) =>
                        st.id === id ? { ...st, likes_count: (st.likes_count || 0) + 1 } : st
                      ));
                      awardLikeXP(uid).catch(() => {});
                    }
                  } catch (error) {
                    console.error('Error toggling like:', error);
                  }
                }}
              />
            )}
            ListEmptyComponent={
              <Text style={{ color: C.textSecondary, textAlign: 'center', marginTop: 24 }}>
                Aún no hay historias.
              </Text>
            }
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}
    </View>
  );
}

// ─── StoryCard ────────────────────────────────────────────────────────────────
function StoryCard({
  item, liked, userId, onToggleLike,
}: {
  item: DBStory;
  liked: boolean;
  userId: string | null;
  onToggleLike: (id: string) => void;
}) {
  const router = useRouter();
  const navLock = useRef(false);
  const [opening, setOpening] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likeUsers, setLikeUsers] = useState<LikeUser[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const hasCover = !!item.cover_url;
  const profileArr = toArray(item.profiles);
  const author = profileArr[0]?.display_name?.trim() || 'Autor';
  const avatar = profileArr[0]?.avatar_url ?? null;
  const isAdmin = profileArr[0]?.is_admin ?? false;
  const createdAt = profileArr[0]?.created_at ?? '';
  const isEarlyUser = new Date(createdAt) < new Date('2026-01-01');
  const authorXP = profileArr[0]?.user_gamification?.[0]?.xp ?? 0;

  const excerpt = useMemo(() => {
    const txt = (item.body || '').trim();
    const normalized = txt.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ');
    const lines = normalized.split('\n');
    const wasCutByLines = lines.length > 3;
    const firstLines = lines.slice(0, 3).join('\n');
    const wasCutByChars = firstLines.length > 140;
    const sliced = wasCutByChars ? firstLines.slice(0, 140).trimEnd() : firstLines;
    return { text: sliced, truncated: wasCutByLines || wasCutByChars };
  }, [item.body]);

  const handleLikePress = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try { await onToggleLike(item.id); } finally { setIsLiking(false); }
  };

  const handleShowLikes = async () => {
    setShowLikesModal(true);
    setLoadingLikes(true);
    try {
      const { data: likes, error } = await supabase
        .from('story_likes')
        .select(`user_id, profiles!story_likes_user_id_fkey ( id, display_name, avatar_url, is_admin, created_at )`)
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

  const likesCount = item.likes_count ?? 0;
  const commentsCount = item.comments_count ?? 0;

  return (
    <>
      <View style={s.card}>
        {/* Header: avatar + autor + badge categoría */}
        <Link href={{ pathname: '/profile/[id]', params: { id: item.author_id } }} asChild>
          <TouchableOpacity activeOpacity={0.85} style={s.headerRow} disabled={opening}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, {
                backgroundColor: C.avatarBg, borderWidth: 1,
                borderColor: C.avatarBorder, alignItems: 'center', justifyContent: 'center',
              }]}>
                <Ionicons name="person-outline" size={14} color={C.textSecondary} />
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
              <Text style={s.author}>{author}</Text>
              {getStaticBadges(isAdmin, createdAt).map((b) => (
                <BadgeIcon key={b.id} iconKey={b.icon} size={14} color={b.color} />
              ))}
              <MaterialCommunityIcons name={getCurrentLevel(authorXP).icon as any} size={14} color={getCurrentLevel(authorXP).color} />
            </View>
            {/* ── BADGE CATEGORÍA ── */}
            {item.category && <CategoryBadge category={item.category} />}
          </TouchableOpacity>
        </Link>

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={opening}
          onPress={() => {
            if (navLock.current) return;
            navLock.current = true;
            setOpening(true);
            router.push({
              pathname: '/story/[id]',
              params: {
                id: item.id, title: item.title, author,
                body: item.body, cover: item.cover_url ?? '',
                likes: String(item.likes_count ?? 0),
                comments: String(item.comments_count ?? 0),
                source: 'home',
              },
            });
            setTimeout(() => { navLock.current = false; setOpening(false); }, 900);
          }}
        >
          <Text style={s.cardTitle}>{item.title}</Text>
          {hasCover && <Image source={{ uri: item.cover_url! }} style={s.cardImg} />}
          <View style={!hasCover ? { marginTop: 6 } : undefined}>
            <Text style={s.excerpt} numberOfLines={3}>
              {excerpt.text}
              {excerpt.truncated && <Text style={s.excerptMore}> … Ver más</Text>}
            </Text>
          </View>

          {/* Footer */}
          <View style={s.footerRow}>
            <TouchableOpacity style={s.meta} onPress={handleLikePress} activeOpacity={0.8} disabled={isLiking}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'} size={20}
                color={liked ? C.like : C.textSecondary}
                style={{ opacity: isLiking ? 0.5 : 1 }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.metaText, { marginLeft: 4 }]} onPress={handleShowLikes}
              activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[s.metaTxt, liked && { color: C.like }]}>
                {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
              </Text>
            </TouchableOpacity>

            <View style={[s.meta, { marginLeft: 16 }]}>
              <Ionicons name="chatbox-outline" size={20} color={C.textSecondary} />
            </View>
            <View style={[s.metaText, { marginLeft: 4 }]}>
              <Text style={s.metaTxt}>
                {commentsCount} {commentsCount === 1 ? 'Comentario' : 'Comentarios'}
              </Text>
            </View>

            <TouchableOpacity
              style={[s.meta, { marginLeft: 'auto' }]}
              onPress={() => setShowShare(true)}
              activeOpacity={0.8}
              hitSlop={10}
            >
              <Ionicons name="share-social-outline" size={20} color={C.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>

      {/* Modal likes */}
      <Modal visible={showLikesModal} transparent animationType="fade">
        <View style={s.likesOverlay}>
          <TouchableOpacity style={s.likeBackdrop} onPress={() => setShowLikesModal(false)} />
          <View style={s.likesSheet}>
            <View style={s.likesHeader}>
              <Text style={s.likesTitle}>Les dio like</Text>
              <TouchableOpacity onPress={() => setShowLikesModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={C.textPrimary} />
              </TouchableOpacity>
            </View>
            {loadingLikes ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={C.textPrimary} />
              </View>
            ) : likeUsers.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: C.textSecondary }}>Sin likes aún</Text>
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
                          <View style={[s.likeUserAvatar, {
                            backgroundColor: C.avatarBg, alignItems: 'center', justifyContent: 'center',
                          }]}>
                            <Ionicons name="person-outline" size={16} color={C.textSecondary} />
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                          <Text style={s.likeUserName}>{user.display_name || 'Usuario'}</Text>
                          {getStaticBadges(user.is_admin, user.created_at).map((b) => (
                            <BadgeIcon key={b.id} iconKey={b.icon} size={14} color={b.color} />
                          ))}
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={C.textSecondary} style={{ marginLeft: 'auto' }} />
                      </TouchableOpacity>
                    </Link>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {userId && (
        <ShareStorySheet
          visible={showShare}
          onClose={() => setShowShare(false)}
          currentUserId={userId}
          story={{
            id: item.id,
            title: item.title,
            cover_url: item.cover_url,
            author: author,
            author_avatar: avatar,
          }}
        />
      )}
    </>
  );
}

// ─── Estilos (sin cambios) ────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  card: {
    backgroundColor: C.card, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: C.cardBorder, padding: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.avatarBg, borderWidth: 1, borderColor: C.avatarBorder,
  },
  author: { color: C.textPrimary, fontWeight: '600' },
  cardTitle: { color: C.textPrimary, fontWeight: '700', fontSize: 18, marginBottom: 8 },
  cardImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 8 },
  excerpt: { color: '#E4E4E7', lineHeight: 20 },
  excerptMore: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  footerRow: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12,
  },
  meta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { flexDirection: 'row', alignItems: 'center' },
  metaTxt: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  likesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  likeBackdrop: { position: 'absolute', width: '100%', height: '100%' },
  likesSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: C.cardBorder, maxHeight: '75%', zIndex: 10,
  },
  likesHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.cardBorder,
  },
  likesTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700' },
  likeUserCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
    borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder, padding: 12, gap: 12,
  },
  likeUserAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.avatarBorder },
  likeUserName: { color: C.textPrimary, fontWeight: '600' },
});
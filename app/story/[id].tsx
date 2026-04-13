// app/story/[id].tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Keyboard,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { like, unlike } from '../../lib/likes';
import { addComment as addCommentService } from '../../lib/comments';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import ShareStorySheet from '../../components/ShareStorySheet';
import { BadgeIcon } from '../profile/settings';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  TapGestureHandler,
  State,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
type StoryCategory = 'mito' | 'leyenda' | 'urbana' | 'otra';

type Params = {
  id: string;
  source?: 'home' | 'profile' | 'notifications' | 'chat' | 'public-profile';
};

type Comment = {
  id: string;
  userId: string;
  author: string;
  avatarUrl: string | null;
  text: string;
  createdAt: number;
  is_admin: boolean;
  created_at: string;
  userBadges?: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    scope?: string;
  }[];
};

type LikeUser = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  userBadges?: {
    id: string;
    name: string;
    color: string;
    icon: string | null;
    scope?: string;
  }[];
};

// ─── Config de categorías para el badge ───────────────────────────────────────

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

// ─── Orb pulsante ─────────────────────────────────────────────────────────────
function LoadingOrb() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.18, { duration: 950, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    opacity.value = withRepeat(
      withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    };
  }, []);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        orbStyle,
        {
          width: 86,
          height: 86,
          borderRadius: 43,
          backgroundColor: '#0C0C12',
          borderWidth: 1.5,
          borderColor: '#2A2A35',
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Ionicons name="book-outline" size={34} color="#4B4B5A" />
    </Animated.View>
  );
}

// ─── Skeleton de carga ────────────────────────────────────────────────────────
function StorySkeleton() {
  const fadeIn = useSharedValue(0);

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 280 });
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeIn.value }));

  return (
    <Animated.View
      style={[
        fadeStyle,
        {
          flex: 1,
          backgroundColor: '#030000',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 20,
          paddingBottom: 60,
        },
      ]}
    >
      <LoadingOrb />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: '#F3F4F6', fontSize: 18, fontWeight: '700', letterSpacing: 0.4 }}>
          Cargando historia
        </Text>
        <Text style={{ color: '#4B4B5A', fontSize: 13 }}>Por favor espera...</Text>
      </View>
    </Animated.View>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function StoryDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, source } = useLocalSearchParams<Params>();

  const storyId = useMemo(() => id ?? String(Date.now()), [id]);

  // ── Estado ────────────────────────────────────────────────────────────────
  const [likeCount, setLikeCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentList, setCommentList] = useState<Comment[]>([]);
  const [initialCommentCount, setInitialCommentCount] = useState<number>(0);
  const [sendingComment, setSendingComment] = useState(false);

  const [storyTitle, setStoryTitle] = useState<string>('');
  const [storyBody, setStoryBody] = useState<string>('');
  const [storyCover, setStoryCover] = useState<string | undefined>(undefined);
  const [storyCategory, setStoryCategory] = useState<StoryCategory | null>(null);
  const [authorName, setAuthorName] = useState<string>('');
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null); // ← NUEVO

  const [userId, setUserId] = useState<string | null>(null);
  const [storyAuthorId, setStoryAuthorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showDeleteStoryModal, setShowDeleteStoryModal] = useState(false);
  const [deletingStory, setDeletingStory] = useState(false);

  const [showImageZoom, setShowImageZoom] = useState(false);

  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likeUsers, setLikeUsers] = useState<LikeUser[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);

  const [showShare, setShowShare] = useState(false); // ← NUEVO

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

  // Fade-in del contenido
  const contentOpacity = useSharedValue(0);
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  useEffect(() => {
    if (!loading) {
      contentOpacity.value = withTiming(1, {
        duration: 380,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [loading]);

  function showNotification(
    title: string,
    message: string,
    variant: 'info' | 'error' = 'info',
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

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // ── 1. Obtiene el usuario en paralelo ────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  // ── 2. Verifica admin cuando userId esté listo ───────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()
      .then(({ data }) => setIsAdmin(data?.is_admin ?? false));
  }, [userId]);

  // ── 3. Carga la historia ─────────────────────────────────────────────────
  useEffect(() => {
    const loadStory = async () => {
      try {
        const { data, error } = await supabase
          .from('stories')
          .select(`
            id,
            title,
            body,
            cover_url,
            likes_count,
            comments_count,
            author_id,
            category,
            profiles!stories_author_id_fkey ( display_name, avatar_url )
          `)
          .eq('id', storyId)
          .maybeSingle();

        if (!error && data) {
          const profile = Array.isArray(data.profiles)
            ? data.profiles[0]
            : (data.profiles ?? null);

          setStoryTitle(data.title || 'Historia');
          setStoryBody(data.body || 'Sin contenido.');
          setStoryCover(data.cover_url || undefined);
          setStoryCategory(data.category || null);
          setAuthorName(profile?.display_name?.trim() || '');
          setAuthorAvatar(profile?.avatar_url ?? null); // ← NUEVO
          setLikeCount(data.likes_count || 0);
          setInitialCommentCount(data.comments_count || 0);
          setStoryAuthorId(data.author_id || null);
        } else {
          setStoryTitle('Historia no encontrada');
          setStoryBody('No se pudo cargar esta historia.');
        }
      } catch (e) {
        console.error('Error loading story:', e);
        setStoryTitle('Error');
        setStoryBody('No se pudo cargar esta historia.');
      } finally {
        setLoading(false);
      }
    };

    loadStory();
  }, [storyId]);

  // ── 4. Verifica si el usuario dio like ───────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('story_likes')
      .select('*', { count: 'exact', head: true })
      .eq('story_id', storyId)
      .eq('user_id', userId)
      .then(({ count }) => setLiked((count ?? 0) > 0));
  }, [storyId, userId]);

  const fetchComments = useCallback(async () => {
    const { data: rows } = await supabase
      .from('story_comments')
      .select('id, text, created_at, user_id')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false });

    if (!rows) { setCommentList([]); return; }

    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id))).filter(Boolean);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, is_admin, created_at')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
    const badgesMap = new Map<string, any[]>();

    // Cargar insignias asignadas (custom)
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

    // Cargar badges de scope (all_users, admin_only)
    const { data: scopeBadges } = await supabase
      .from('badges')
      .select('id, name, description, color, icon, scope')
      .order('name', { ascending: true });

    (scopeBadges || []).forEach((badge: any) => {
      if (badge.scope === 'all_users') {
        userIds.forEach((uid) => {
          const existing = badgesMap.get(uid) || [];
          const yaExiste = existing.some((b: any) => b.id === badge.id);
          if (!yaExiste) {
            existing.push(badge);
            badgesMap.set(uid, existing);
          }
        });
      } else if (badge.scope === 'admin_only') {
        userIds.forEach((uid) => {
          const profile = profileMap.get(uid);
          if (profile?.is_admin) {
            const existing = badgesMap.get(uid) || [];
            const yaExiste = existing.some((b: any) => b.id === badge.id);
            if (!yaExiste) {
              existing.push(badge);
              badgesMap.set(uid, existing);
            }
          }
        });
      }
    });

    const comments = rows.map((c: any) => {
      const profile = profileMap.get(c.user_id);
      return {
        id: c.id,
        userId: c.user_id,
        author: profile?.display_name ?? 'Usuario',
        avatarUrl: profile?.avatar_url ?? null,
        text: c.text,
        createdAt: new Date(c.created_at).getTime(),
        is_admin: profile?.is_admin ?? false,
        created_at: profile?.created_at ?? '',
        userBadges: badgesMap.get(c.user_id) || [],
      };
    });

    setCommentList(comments);
  }, [storyId]);

  useEffect(() => {
    fetchComments();
  }, [storyId, fetchComments]);

  const handleShowLikes = async () => {
    setShowLikesModal(true);
    setLoadingLikes(true);
    try {
      const { data: likes, error } = await supabase
        .from('story_likes')
        .select(`
          user_id,
          profiles!story_likes_user_id_fkey (
            id, display_name, avatar_url, is_admin, created_at
          )
        `)
        .eq('story_id', storyId);

      if (error) throw error;

      const userIds = (likes ?? []).map((l: any) => l.user_id);
      const profileMap = new Map((likes ?? []).map((l: any) => [l.profiles?.id, l.profiles]));
      const badgesMap = new Map<string, any[]>();

      // Cargar insignias asignadas (custom)
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
        id: like.profiles?.id,
        display_name: like.profiles?.display_name,
        avatar_url: like.profiles?.avatar_url,
        is_admin: like.profiles?.is_admin,
        created_at: like.profiles?.created_at,
        userBadges: badgesMap.get(like.user_id) || [],
      }));
      setLikeUsers(users);
    } catch (e: any) {
      console.error('Error cargando likes:', e);
    } finally {
      setLoadingLikes(false);
    }
  };

  async function handleDeleteComment(commentId: string) {
    try {
      const { error } = await supabase
        .from('story_comments')
        .delete()
        .eq('id', commentId);

      if (error) {
        showNotification('Error', 'No se pudo borrar el comentario', 'error');
        setShowDeleteModal(false);
        return;
      }

      setCommentList((prev) => prev.filter((c) => c.id !== commentId));
      setShowDeleteModal(false);
      showNotification('Listo', 'Comentario eliminado', 'info');
    } catch {
      showNotification('Error', 'No se pudo borrar el comentario', 'error');
      setShowDeleteModal(false);
    }
  }

  function confirmDelete(comment: Comment) {
    const canDelete = userId === comment.userId || userId === storyAuthorId || isAdmin;
    if (!canDelete) {
      showNotification('Sin permiso', 'No puedes borrar este comentario', 'error');
      return;
    }
    setSelectedComment(comment);
    setShowDeleteModal(true);
  }

  async function toggleLike() {
    if (!userId) {
      showNotification('Sesión requerida', 'Debes iniciar sesión para dar like.', 'info');
      return;
    }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount((prev) => (newLiked ? prev + 1 : prev - 1));
    try {
      if (liked) await unlike(storyId);
      else await like(storyId);
    } catch {
      setLiked(!newLiked);
      setLikeCount((prev) => (newLiked ? prev - 1 : prev + 1));
      showNotification('Error', 'No se pudo procesar el like', 'error');
    }
  }

  async function addComment() {
    const text = commentInput.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    try {
      await addCommentService(storyId, text);
      await fetchComments();
      setCommentInput('');
      Keyboard.dismiss();
    } catch {
      showNotification('Error', 'No se pudo guardar el comentario.', 'error');
    } finally {
      setSendingComment(false);
    }
  }

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  async function handleDeleteStory() {
    if (!userId || deletingStory) return;
    const canDelete = userId === storyAuthorId || isAdmin;
    if (!canDelete) {
      showNotification('Sin permiso', 'No tienes permiso para eliminar esta historia.', 'error');
      return;
    }
    setDeletingStory(true);
    try {
      const { error } = await supabase.from('stories').delete().eq('id', storyId);
      if (error) throw error;
      setShowDeleteStoryModal(false);
      showNotification('Listo', 'La historia ha sido eliminada.', 'info', 'Cerrar', handleBack);
    } catch {
      showNotification('Error', 'No se pudo eliminar la historia.', 'error');
      setDeletingStory(false);
      setShowDeleteStoryModal(false);
    }
  }

  const displayCommentCount = commentList.length || initialCommentCount;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#030000' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[s.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={handleBack} hitSlop={10} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
          </TouchableOpacity>

          {loading ? (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 140, height: 14, borderRadius: 6, backgroundColor: '#1F1F27' }} />
            </View>
          ) : (
            <Text style={s.headerTitle} numberOfLines={1}>{storyTitle}</Text>
          )}

          {/* Botones derecha: compartir + eliminar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {!loading && (
              <TouchableOpacity
                onPress={() => setShowShare(true)}
                hitSlop={10}
                style={s.headerIconBtn}
              >
                <Ionicons name="share-social-outline" size={22} color="#F3F4F6" />
              </TouchableOpacity>
            )}
            {!loading && (userId === storyAuthorId || isAdmin) ? (
              <TouchableOpacity
                onPress={() => setShowDeleteStoryModal(true)}
                hitSlop={10}
                style={s.deleteBtn}
              >
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 32 }} />
            )}
          </View>
        </View>

        <View style={{ flex: 1 }}>
          {loading ? (
            <StorySkeleton />
          ) : (
            <Animated.View style={[{ flex: 1 }, contentStyle]}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[s.content, { paddingBottom: 80 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {storyCover && (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setShowImageZoom(true)}>
                    <Image source={{ uri: storyCover }} style={s.coverImg} />
                  </TouchableOpacity>
                )}

                <Text style={s.bodyText}>{storyBody}</Text>

                {authorName ? (
                  <View style={s.authorRow}>
                    <Text style={s.author}>— </Text>
                    <Link href={{ pathname: '/profile/[id]', params: { id: storyAuthorId || '' } }} asChild>
                      <TouchableOpacity activeOpacity={0.7}>
                        <Text style={[s.author, s.authorLink]}>{authorName}</Text>
                      </TouchableOpacity>
                    </Link>
                    {storyCategory && <CategoryBadge category={storyCategory} />}
                  </View>
                ) : null}

                <View style={s.footerRow}>
                  <TouchableOpacity
                    style={s.meta}
                    onPress={toggleLike}
                    activeOpacity={0.8}
                    disabled={!userId}
                  >
                    <Ionicons
                      name={liked ? 'heart' : 'heart-outline'}
                      size={20}
                      color={liked ? '#ef4444' : '#F3F4F6'}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.metaText, { marginLeft: 4 }]}
                    onPress={handleShowLikes}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[s.metaTxt, liked && { color: '#ef4444' }]}>
                      {likeCount} {likeCount === 1 ? 'Like' : 'Likes'}
                    </Text>
                  </TouchableOpacity>

                  <View style={[s.meta, { marginLeft: 16 }]}>
                    <Ionicons name="chatbox-outline" size={20} color="#F3F4F6" />
                  </View>

                  <View style={[s.metaText, { marginLeft: 4 }]}>
                    <Text style={s.metaTxt}>
                      {displayCommentCount}{' '}
                      {displayCommentCount === 1 ? 'Comentario' : 'Comentarios'}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 8, marginTop: 4 }}>
                  {commentList.map((c) => {
                    const canDeleteThisComment =
                      userId === c.userId || userId === storyAuthorId || isAdmin;
                    const isEarlyUser = new Date(c.created_at) < new Date('2026-01-01');

                    return (
                      <TouchableOpacity
                        key={c.id}
                        onLongPress={() => canDeleteThisComment && confirmDelete(c)}
                        delayLongPress={400}
                        activeOpacity={0.9}
                        disabled={!canDeleteThisComment}
                      >
                        <View style={[s.commentCard, !canDeleteThisComment && { opacity: 0.6 }]}>
                          <View style={s.commentHeader}>
                            {c.avatarUrl ? (
                              <Image source={{ uri: c.avatarUrl }} style={s.commentAvatar} />
                            ) : (
                              <View style={[s.commentAvatar, { alignItems: 'center', justifyContent: 'center' }]}>
                                <Ionicons name="person-outline" size={14} color="#9CA3AF" />
                              </View>
                            )}
                            <Link href={{ pathname: '/profile/[id]', params: { id: c.userId } }} asChild>
                              <TouchableOpacity>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                  <Text style={s.commentAuthor}>{c.author}</Text>
                                  {c.userBadges?.map((badge, idx) => (
                                    <BadgeIcon
                                      key={idx}
                                      iconKey={badge.icon || 'verified_MI_0'}
                                      size={12}
                                      color={badge.color || '#F3F4F6'}
                                    />
                                  ))}
                                </View>
                              </TouchableOpacity>
                            </Link>
                          </View>
                          <Text style={s.commentText}>{c.text}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </Animated.View>
          )}

          {/* ── Barra de comentarios ──────────────────────────────────────── */}
          <View
            style={[
              s.inputBar,
              {
                marginBottom: keyboardHeight,
                paddingBottom:
                  keyboardHeight === 0 ? (insets.bottom > 0 ? insets.bottom : 10) : 10,
              },
              sendingComment && { opacity: 0.6 },
            ]}
          >
            <FontAwesome5 name="comment-alt" size={18} color="#A1A1AA" />
            <TextInput
              placeholder="Agrega un comentario"
              placeholderTextColor="#dbdbdb"
              style={s.input}
              value={commentInput}
              onChangeText={setCommentInput}
              editable={!sendingComment}
              returnKeyType="send"
              onSubmitEditing={addComment}
            />
            <TouchableOpacity
              hitSlop={10}
              onPress={addComment}
              disabled={!commentInput.trim() || sendingComment}
            >
              <Ionicons name="send-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Modales ───────────────────────────────────────────────────────── */}
        <ImageZoomModal
          visible={showImageZoom}
          imageUri={storyCover || ''}
          onClose={() => setShowImageZoom(false)}
        />

        <Modal visible={showDeleteModal} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <Text style={s.modalTitle}>Eliminar comentario</Text>
              <Text style={s.modalText}>¿Seguro que quieres eliminar este comentario?</Text>
              <View style={s.modalButtons}>
                <TouchableOpacity
                  onPress={() => setShowDeleteModal(false)}
                  style={[s.modalBtn, { backgroundColor: '#333' }]}
                >
                  <Text style={s.modalBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => selectedComment && handleDeleteComment(selectedComment.id)}
                  style={[s.modalBtn, { backgroundColor: '#ef4444' }]}
                >
                  <Text style={[s.modalBtnText, { color: '#fff' }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showDeleteStoryModal} transparent animationType="fade">
          <View style={s.modalOverlay}>
            <View style={s.modalBox}>
              <View style={s.iconWrapDelete}>
                <Ionicons name="warning" size={28} color="#ef4444" />
              </View>
              <Text style={s.modalTitle}>Eliminar historia</Text>
              <Text style={s.modalText}>Esta acción no se puede deshacer. ¿Estás seguro?</Text>
              <View style={s.modalButtons}>
                <TouchableOpacity
                  onPress={() => setShowDeleteStoryModal(false)}
                  style={[s.modalBtn, { backgroundColor: '#333' }]}
                  disabled={deletingStory}
                >
                  <Text style={s.modalBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDeleteStory}
                  style={[s.modalBtn, { backgroundColor: '#ef4444' }]}
                  disabled={deletingStory}
                >
                  {deletingStory ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[s.modalBtnText, { color: '#fff' }]}>Eliminar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
                        <TouchableOpacity
                          style={s.likeUserCard}
                          onPress={() => setShowLikesModal(false)}
                        >
                          {user.avatar_url ? (
                            <Image source={{ uri: user.avatar_url }} style={s.likeUserAvatar} />
                          ) : (
                            <View style={[s.likeUserAvatar, { backgroundColor: '#0F1016', alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name="person-outline" size={16} color="#9CA3AF" />
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                            <Text style={s.likeUserName}>{user.display_name || 'Usuario'}</Text>
                            {user.userBadges?.map((badge, idx) => (
                              <BadgeIcon
                                key={idx}
                                iconKey={badge.icon || 'verified_MI_0'}
                                size={14}
                                color={badge.color || '#F3F4F6'}
                              />
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

        <Modal visible={showSheet} transparent animationType="fade" onRequestClose={() => setShowSheet(false)}>
          <View style={s.overlay}>
            <View style={s.sheet}>
              <View style={[s.iconWrap, sheet.variant === 'error'
                ? { backgroundColor: '#3F1D1D', borderColor: '#7F1D1D' }
                : { backgroundColor: '#1F2937', borderColor: '#374151' }
              ]}>
                <Ionicons
                  name={sheet.variant === 'error' ? 'alert-circle' : 'checkmark-circle'}
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

        {/* ── ShareStorySheet ─────────────────────────────────────────────── */}
        {userId && (
          <ShareStorySheet
            visible={showShare}
            onClose={() => setShowShare(false)}
            currentUserId={userId}
            story={{
              id: storyId,
              title: storyTitle,
              cover_url: storyCover ?? null,
              author: authorName,
              author_avatar: authorAvatar,
            }}
          />
        )}

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── ImageZoomModal ───────────────────────────────────────────────────────────
function ImageZoomModal({
  visible,
  imageUri,
  onClose,
}: {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
}) {
  const scale = useSharedValue(1);
  const baseScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const doubleTapRef = useCallback((ref: any) => ref, []);

  const onDoubleTap = (event: any) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      if (scale.value > 1) {
        scale.value = withSpring(1);
        baseScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else {
        scale.value = withSpring(2);
        baseScale.value = 2;
      }
    }
  };

  const onPinch = (event: any) => {
    scale.value = baseScale.value * event.nativeEvent.scale;
  };

  const onPinchEnd = () => {
    baseScale.value = scale.value;
    if (scale.value < 1) {
      scale.value = withSpring(1);
      baseScale.value = 1;
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={s.zoomOverlay}>
        <TouchableOpacity style={s.zoomCloseBtn} onPress={onClose} hitSlop={10}>
          <Ionicons name="close-circle" size={40} color="#fff" />
        </TouchableOpacity>
        <TapGestureHandler ref={doubleTapRef} onHandlerStateChange={onDoubleTap} numberOfTaps={2}>
          <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <PinchGestureHandler onGestureEvent={onPinch} onEnded={onPinchEnd}>
              <Animated.View style={animatedStyle}>
                <Image source={{ uri: imageUri }} style={s.zoomImage} resizeMode="contain" />
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </TapGestureHandler>
      </View>
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#030000',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#F3F4F6',
    fontSize: 18,
    fontWeight: '700',
  },
  headerIconBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  coverImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  bodyText: { color: '#E5E7EB', lineHeight: 22, fontSize: 15 },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  author: { color: '#C9C9D1', fontStyle: 'italic' },
  authorLink: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: '#6B7280',
  },
  footerRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1F1F27',
    paddingTop: 12,
  },
  meta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { flexDirection: 'row', alignItems: 'center' },
  metaTxt: { color: '#F3F4F6', fontSize: 14, fontWeight: '600' },
  commentCard: {
    backgroundColor: '#010102',
    borderWidth: 1,
    borderColor: '#181818',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F1016',
    borderWidth: 1,
    borderColor: '#1F1F27',
  },
  commentAuthor: { color: '#fff', fontWeight: '600' },
  commentText: { color: '#d0d1d1' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#030000',
    borderTopWidth: 1,
    borderTopColor: '#1F1F27',
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F1F27',
    paddingHorizontal: 12,
    color: '#F3F4F6',
    backgroundColor: '#0B0B0F',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#111',
    borderRadius: 16,
    width: '80%',
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalText: { color: '#ccc', textAlign: 'center', marginBottom: 20 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  modalBtnText: { color: '#f3f4f6', fontSize: 15, fontWeight: '600' },
  iconWrapDelete: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2D1515',
    borderWidth: 1,
    borderColor: '#5F1515',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  zoomImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7 },
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
  sheetTitle: { color: '#F3F4F6', fontWeight: '700', fontSize: 18, textAlign: 'center' },
  sheetMsg: { color: '#D1D5DB', textAlign: 'center', marginTop: 6 },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    justifyContent: 'center',
  },
  sheetBtn: {
    height: 44,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  sheetBtnPrimary: { backgroundColor: '#1F2937', borderColor: '#27272A' },
  sheetBtnText: { fontWeight: '600', color: '#fff' },
  likesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  likeBackdrop: { position: 'absolute', width: '100%', height: '100%' },
  likesSheet: {
    backgroundColor: '#010102',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#181818',
    maxHeight: '75%',
    zIndex: 10,
  },
  likesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#181818',
  },
  likesTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '700' },
  likeUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#010102',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#181818',
    padding: 12,
    gap: 12,
  },
  likeUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2C2C33',
  },
  likeUserName: { color: '#F3F4F6', fontWeight: '600' },
});

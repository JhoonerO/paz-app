// app/profile/[id].tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useFonts, Risque_400Regular } from '@expo-google-fonts/risque';
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
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DBStory = {
  id: string;
  title: string;
  body: string;
  cover_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_id: string;
  profiles: { display_name: string | null; avatar_url: string | null }[] | null;
  liked_at?: string;
};

type ProfileRow = {
  id: string;
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
};

const toArray = (p: any) => (Array.isArray(p) ? p : p ? [p] : []);

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

function PublicProfileSkeleton({ insetTop }: { insetTop: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header falso sincronizado con el header real */}
      <View style={[sk.fakeHeader, { height: 56 + insetTop, paddingTop: insetTop }]}>
        <View style={sk.fakeHeaderBack} />
        <View style={sk.fakeHeaderTitle} />
        <View style={{ width: 32 }} />
      </View>
      <ProfileHeaderSkeleton />
      <TabsSkeleton />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        {[...Array(3)].map((_, i) => (
          <StoryCardSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────
export default function PublicProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id: profileId, source } = useLocalSearchParams<{
    id: string;
    source?: string;
  }>();

  const fromChat = source === 'chat';
  const [fontsLoaded] = useFonts({ Risque_400Regular });

  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState<string>('Usuario');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [likesPublic, setLikesPublic] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [createdAt, setCreatedAt] = useState<string>('');

  const [tab, setTab] = useState<'mine' | 'likes'>('mine');
  const [stories, setStories] = useState<DBStory[]>([]);
  const [likedStories, setLikedStories] = useState<DBStory[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const [showAvatarZoom, setShowAvatarZoom] = useState(false);
  const [badgeModal, setBadgeModal] = useState<{
    visible: boolean;
    type: 'admin' | 'early' | null;
  }>({ visible: false, type: null });

  const loadFromSupabase = useCallback(async () => {
    try {
      if (!profileId) return;

      const { data: authData } = await supabase.auth.getUser();
      const uidViewer = authData.user?.id ?? null;
      setViewerId(uidViewer);

      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, likes_public, is_admin, created_at')
        .eq('id', profileId)
        .single<ProfileRow>();
      if (profErr) throw profErr;

      setDisplayName(prof?.display_name || 'Usuario');
      setAvatarUrl(prof?.avatar_url ?? null);
      setLikesPublic(prof?.likes_public ?? true);
      setIsAdmin(prof?.is_admin ?? false);
      setCreatedAt(prof?.created_at ?? '');

      const { data: mine, error: mineErr } = await supabase
        .from('stories')
        .select(`
          id, title, body, cover_url, likes_count, comments_count,
          created_at, author_id,
          profiles!stories_author_id_fkey ( display_name, avatar_url )
        `)
        .eq('author_id', profileId)
        .order('created_at', { ascending: false });
      if (mineErr) throw mineErr;

      const storiesWithAuthor: DBStory[] = (mine ?? []).map((story: any) => {
        const embeddedArr = toArray(story.profiles);
        const current = embeddedArr[0];

        if (!current || current.display_name == null || current.avatar_url == null) {
          return {
            ...story,
            profiles: [{
              display_name: current?.display_name ?? prof?.display_name ?? 'Autor',
              avatar_url: current?.avatar_url ?? prof?.avatar_url ?? null,
            }],
          };
        }

        return { ...story, profiles: embeddedArr };
      });
      setStories(storiesWithAuthor);

      let likedList: DBStory[] = [];
      if (prof?.likes_public) {
        const { data: likeRows, error: likeErr } = await supabase
          .from('story_likes')
          .select('story_id, created_at')
          .eq('user_id', profileId)
          .order('created_at', { ascending: false });
        if (likeErr) throw likeErr;

        const ids = (likeRows || []).map((r: any) => r.story_id as string);
        if (ids.length) {
          const likedAtMap = new Map<string, string>();
          (likeRows || []).forEach((r: any) => likedAtMap.set(r.story_id, r.created_at));

          const { data: liked, error: likedErr } = await supabase
            .from('stories')
            .select(`
              id, title, body, cover_url, likes_count, comments_count,
              created_at, author_id,
              profiles!stories_author_id_fkey ( display_name, avatar_url )
            `)
            .in('id', ids);
          if (likedErr) throw likedErr;

          const authorIds = Array.from(
            new Set((liked ?? []).map((s: any) => s.author_id))
          );
          const pMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
          if (authorIds.length) {
            const { data: authorProfiles } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .in('id', authorIds);
            (authorProfiles ?? []).forEach((p: any) => {
              pMap.set(p.id, {
                display_name: p.display_name ?? null,
                avatar_url: p.avatar_url ?? null,
              });
            });
          }

          likedList = (liked ?? []).map((story: any) => {
            const embeddedArr = toArray(story.profiles);
            const current = embeddedArr[0] ?? null;
            const fromMap = pMap.get(story.author_id) ?? null;

            const display_name =
              current?.display_name ?? fromMap?.display_name ?? 'Autor';
            const avatar_url =
              current?.avatar_url ?? fromMap?.avatar_url ?? null;

            return {
              ...story,
              liked_at: likedAtMap.get(story.id),
              profiles: [{ display_name, avatar_url }],
            };
          });

          likedList.sort((a, b) => {
            const da = a.liked_at ?? a.created_at;
            const db = b.liked_at ?? b.created_at;
            return db.localeCompare(da);
          });
        }
      }
      setLikedStories(likedList);

      if (uidViewer) {
        const allIds = [
          ...storiesWithAuthor.map((s) => s.id),
          ...likedList.map((s) => s.id),
        ];
        const unique = Array.from(new Set(allIds));
        if (unique.length) {
          const { data: viewerLikes } = await supabase
            .from('story_likes')
            .select('story_id')
            .eq('user_id', uidViewer)
            .in('story_id', unique);
          setLikedIds(new Set((viewerLikes ?? []).map((r: any) => r.story_id)));
        } else {
          setLikedIds(new Set());
        }
      } else {
        setLikedIds(new Set());
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'No se pudo cargar el perfil.');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  const goToChat = useCallback(async () => {
    if (!viewerId || !profileId) return;

    if (fromChat) {
      router.back();
      return;
    }

    const [u1, u2] = [viewerId, profileId].sort();

    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .maybeSingle();

    if (existing) {
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: existing.id,
          otherName: displayName,
          otherAvatar: avatarUrl ?? '',
          otherUserId: profileId,
        },
      });
      return;
    }

    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ user1_id: u1, user2_id: u2 })
      .select('id')
      .single();

    if (error || !created) {
      Alert.alert('Error', 'No se pudo abrir el chat.');
      return;
    }

    router.push({
      pathname: '/chat/[id]',
      params: {
        id: created.id,
        otherName: displayName,
        otherAvatar: avatarUrl ?? '',
        otherUserId: profileId,
      },
    });
  }, [viewerId, profileId, router, displayName, avatarUrl, fromChat]);

  const toggleLike = useCallback(
    async (story: DBStory) => {
      if (!viewerId) return;
      const isLiked = likedIds.has(story.id);

      setLikedIds((prev) => {
        const next = new Set(prev);
        if (isLiked) next.delete(story.id);
        else next.add(story.id);
        return next;
      });

      const bump = (arr: DBStory[], id: string, d: number) =>
        arr.map((s) =>
          s.id === id ? { ...s, likes_count: Math.max(0, (s.likes_count || 0) + d) } : s
        );

      setStories((curr) => bump(curr, story.id, isLiked ? -1 : +1));
      setLikedStories((curr) => bump(curr, story.id, isLiked ? -1 : +1));

      if (isLiked) {
        const { error } = await supabase
          .from('story_likes')
          .delete()
          .match({ user_id: viewerId, story_id: story.id });
        if (error) setLikedIds((prev) => new Set(prev).add(story.id));
      } else {
        const { error } = await supabase
          .from('story_likes')
          .insert({ user_id: viewerId, story_id: story.id });
        if (error)
          setLikedIds((prev) => {
            const n = new Set(prev);
            n.delete(story.id);
            return n;
          });
      }
    },
    [viewerId, likedIds]
  );

  const listData = useMemo(
    () => (tab === 'mine' ? stories : likedStories),
    [tab, stories, likedStories]
  );

  const isEarlyUser = createdAt ? new Date(createdAt) < new Date('2026-01-01') : false;

  // ── Skeleton mientras carga datos o fuentes ───────────────────────────────
  if (loading || !fontsLoaded) return <PublicProfileSkeleton insetTop={insets.top} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={s.screen} edges={['bottom']}>
        <View style={[s.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backButton}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>U-PAZ</Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={s.avatarRow}>
            <View style={s.avatarWrap}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => avatarUrl && setShowAvatarZoom(true)}
              >
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, { backgroundColor: '#0F1016' }]} />
                )}
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={s.name}>{displayName}</Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}
              >
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => setBadgeModal({ visible: true, type: 'admin' })}
                    hitSlop={8}
                  >
                    <MaterialIcons name="verified" size={24} color="#FFD700" />
                  </TouchableOpacity>
                )}
                {isEarlyUser && (
                  <TouchableOpacity
                    onPress={() => setBadgeModal({ visible: true, type: 'early' })}
                    hitSlop={8}
                  >
                    <MaterialIcons name="verified" size={24} color="#06B6D4" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={s.tabs}>
            <View style={s.tabsRow}>
              {/* Tabs izq */}
              <View style={s.tabBtnContainer}>
                <TouchableOpacity
                  onPress={() => setTab('mine')}
                  style={[s.tabBtn, tab === 'mine' && s.tabBtnActive]}
                >
                  <Text style={[s.tabTxt, tab === 'mine' && s.tabTxtActive]}>
                    {`Mis Historias ${stories.length}`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => likesPublic && setTab('likes')}
                  style={[s.tabBtn, tab === 'likes' && s.tabBtnActive, !likesPublic && { borderColor: '#363636ff' }]}
                  disabled={!likesPublic}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[s.tabTxt, tab === 'likes' && s.tabTxtActive]}>Me gusta</Text>
                    {!likesPublic && <Ionicons name="lock-closed-outline" size={14} color="#9CA3AF" />}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Botón mensaje — solo si es perfil ajeno y hay sesión */}
              {viewerId && viewerId !== profileId && (
                <TouchableOpacity
                  style={s.msgIconBtn}
                  onPress={goToChat}
                  activeOpacity={0.8}
                  hitSlop={8}
                >
                  <Ionicons name="chatbox-outline" size={18} color="#F3F4F6" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={listData}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 24,
              paddingTop: 16,
            }}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListEmptyComponent={
              <Text
                style={{ color: '#8A8A93', textAlign: 'center', marginTop: 24 }}
              >
                {tab === 'mine'
                  ? 'Aún no tiene historias.'
                  : likesPublic
                  ? 'No hay historias en "Me gusta".'
                  : 'Likes ocultos.'}
              </Text>
            }
            renderItem={({ item }) => (
              <PublicStoryCard
                item={item}
                isLiked={likedIds.has(item.id)}
                onToggleLike={() => toggleLike(item)}
                viewerId={viewerId}
              />
            )}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <Modal visible={badgeModal.visible} transparent animationType="fade">
          <View style={s.badgeOverlay}>
            <TouchableOpacity
              style={s.badgeBackdrop}
              onPress={() => setBadgeModal({ visible: false, type: null })}
            />
            <View style={s.badgeContent}>
              <TouchableOpacity
                style={s.badgeCloseBtn}
                onPress={() => setBadgeModal({ visible: false, type: null })}
              >
                <Ionicons name="close-circle" size={28} color="#F3F4F6" />
              </TouchableOpacity>

              {badgeModal.type === 'admin' && (
                <View style={s.badgeInfo}>
                  <MaterialIcons name="verified" size={56} color="#FFD700" />
                  <Text style={s.badgeTitle}>Administrador</Text>
                  <Text style={s.badgeDesc}>
                    Esta insignia indica que eres administrador de la aplicación
                    U-PAZ. Tienes permisos especiales para moderar y gestionar
                    contenido.
                  </Text>
                </View>
              )}

              {badgeModal.type === 'early' && (
                <View style={s.badgeInfo}>
                  <MaterialIcons name="verified" size={56} color="#06B6D4" />
                  <Text style={s.badgeTitle}>Usuario Temprano</Text>
                  <Text style={s.badgeDesc}>
                    Fuiste uno de los primeros en unirse a U-PAZ antes de
                    finalizar 2025.
                  </Text>
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
    borderRadius: scale.value === 1 ? (SCREEN_WIDTH * 0.9) / 2 : 0,
  }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={s.zoomOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TapGestureHandler
          ref={doubleTapRef}
          onHandlerStateChange={onDoubleTap}
          numberOfTaps={2}
        >
          <Animated.View style={{ justifyContent: 'center', alignItems: 'center' }}>
            <PinchGestureHandler onGestureEvent={onPinch} onEnded={onPinchEnd}>
              <Animated.View style={animatedStyle}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={(e) => e.stopPropagation()}
                >
                  <Image
                    source={{ uri: imageUri }}
                    style={s.zoomImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              </Animated.View>
            </PinchGestureHandler>
          </Animated.View>
        </TapGestureHandler>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── PublicStoryCard ──────────────────────────────────────────────────────────
function PublicStoryCard({
  item,
  isLiked,
  onToggleLike,
  viewerId,
}: {
  item: DBStory;
  isLiked: boolean;
  onToggleLike: () => void;
  viewerId: string | null;
}) {
  const hasCover = !!item.cover_url;
  const profile0 = toArray(item.profiles)[0] ?? null;

  const authorForCard = profile0?.display_name?.trim() || 'Autor';
  const authorAvatar = profile0?.avatar_url ?? null;

  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likeUsers, setLikeUsers] = useState<LikeUser[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

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
        .eq('story_id', item.id);

      if (error) throw error;

      const users: LikeUser[] = (likes ?? []).map((like: any) => ({
        id: like.profiles.id,
        display_name: like.profiles.display_name,
        avatar_url: like.profiles.avatar_url,
        is_admin: like.profiles.is_admin,
        created_at: like.profiles.created_at,
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
    try {
      await onToggleLike();
    } finally {
      setIsLiking(false);
    }
  };

  const likesCount = item.likes_count ?? 0;
  const commentsCount = item.comments_count ?? 0;

  return (
    <>
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
            source: 'public-profile',
          },
        }}
        asChild
      >
        <TouchableOpacity activeOpacity={0.85} style={s.card}>
          <View style={s.headerRow}>
            {authorAvatar ? (
              <Image source={{ uri: authorAvatar }} style={s.avatarMini} />
            ) : (
              <View
                style={[
                  s.avatarMini,
                  {
                    backgroundColor: '#0F1016',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                ]}
              >
                <Ionicons name="person-outline" size={12} color="#9CA3AF" />
              </View>
            )}
            <Text style={s.authorTxt}>{authorForCard}</Text>
          </View>

          <Text style={s.cardTitle}>{item.title}</Text>

          {hasCover && (
            <Image source={{ uri: item.cover_url! }} style={s.cardImg} />
          )}

          {!hasCover && (
            <Text style={s.excerpt} numberOfLines={3}>
              {item.body}
            </Text>
          )}

          <View style={s.footerRow}>
            <TouchableOpacity
              onPress={handleLikePress}
              style={s.meta}
              hitSlop={10}
              disabled={!viewerId || isLiking}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={16}
                color={isLiked ? '#EF4444' : '#F3F4F6'}
                style={{ opacity: isLiking ? 0.5 : 1 }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShowLikes}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginLeft: 4 }}
            >
              <Text
                style={[
                  s.metaTxt,
                  isLiked && { color: '#EF4444', fontWeight: '700' },
                ]}
              >
                {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
              </Text>
            </TouchableOpacity>

            <View style={[s.meta, { marginLeft: 12 }]}>
              <Ionicons name="chatbox-outline" size={16} color="#F3F4F6" />
            </View>

            <View style={{ marginLeft: 4 }}>
              <Text style={s.metaTxt}>
                {commentsCount}{' '}
                {commentsCount === 1 ? 'Comentario' : 'Comentarios'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Link>

      <Modal visible={showLikesModal} transparent animationType="fade">
        <View style={s.likesOverlay}>
          <TouchableOpacity
            style={s.likeBackdrop}
            onPress={() => setShowLikesModal(false)}
          />
          <View style={s.likesSheet}>
            <View style={s.likesHeader}>
              <Text style={s.likesTitle}>Les dio like</Text>
              <TouchableOpacity
                onPress={() => setShowLikesModal(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={24} color="#F3F4F6" />
              </TouchableOpacity>
            </View>

            {loadingLikes ? (
              <View
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
              >
                <ActivityIndicator size="large" color="#F3F4F6" />
              </View>
            ) : likeUsers.length === 0 ? (
              <View
                style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ color: '#9CA3AF' }}>Sin likes aún</Text>
              </View>
            ) : (
              <FlatList
                data={likeUsers}
                keyExtractor={(it) => it.id}
                contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item: user }) => {
                  const isUserEarly =
                    new Date(user.created_at) < new Date('2026-01-01');
                  return (
                    <Link
                      href={{
                        pathname: '/profile/[id]',
                        params: { id: user.id },
                      }}
                      asChild
                    >
                      <TouchableOpacity
                        style={s.likeUserCard}
                        onPress={() => setShowLikesModal(false)}
                      >
                        {user.avatar_url ? (
                          <Image
                            source={{ uri: user.avatar_url }}
                            style={s.likeUserAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              s.likeUserAvatar,
                              {
                                backgroundColor: '#0F1016',
                                alignItems: 'center',
                                justifyContent: 'center',
                              },
                            ]}
                          >
                            <Ionicons
                              name="person-outline"
                              size={16}
                              color="#9CA3AF"
                            />
                          </View>
                        )}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                            flex: 1,
                          }}
                        >
                          <Text style={s.likeUserName}>
                            {user.display_name || 'Usuario'}
                          </Text>
                          {user.is_admin && (
                            <MaterialIcons
                              name="verified"
                              size={14}
                              color="#FFD700"
                            />
                          )}
                          {isUserEarly && (
                            <MaterialIcons
                              name="verified"
                              size={14}
                              color="#06B6D4"
                            />
                          )}
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color="#9CA3AF"
                          style={{ marginLeft: 'auto' }}
                        />
                      </TouchableOpacity>
                    </Link>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Estilos principales ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000ff' },
  header: {
    backgroundColor: '#000000ff',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#181818ff',
    zIndex: 1000,
  },
  backButton: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    fontFamily: 'Risque_400Regular',
    fontSize: 22,
    color: '#F3F4F6',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#0B0B0F' },
  name: { color: '#F3F4F6', fontSize: 28, fontWeight: '700' },
  badgeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeBackdrop: { position: 'absolute', width: '100%', height: '100%' },
  badgeContent: {
    backgroundColor: '#121219',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#1F1F27',
    alignItems: 'center',
    zIndex: 10,
  },
  badgeCloseBtn: { position: 'absolute', top: 12, right: 12, zIndex: 20 },
  badgeInfo: { alignItems: 'center', marginTop: 8 },
  badgeTitle: {
    color: '#F3F4F6',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  badgeDesc: { color: '#D1D5DB', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  tabs: {
    marginTop: 24,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  msgIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#202020ff',
    backgroundColor: '#000000ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnContainer: {
    flexDirection: 'row',
    height: 40,
    borderRadius: 8,
    backgroundColor: '#000000ff',
    borderWidth: 2,
    borderColor: '#202020ff',
    flex: 1,
    maxWidth: 280,
    overflow: 'hidden',
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  tabBtnActive: { backgroundColor: '#1f1f1fff' },
  tabTxt: { color: '#F3F4F6', fontWeight: '600', fontSize: 16 },
  tabTxtActive: { color: '#FFFFFF', fontWeight: '700' },
  card: {
    backgroundColor: '#010102ff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#181818ff',
    padding: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatarMini: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0F1016',
    borderWidth: 1,
    borderColor: '#1F1F27',
  },
  authorTxt: { color: '#E5E7EB', fontWeight: '600', flex: 1 },
  cardTitle: { color: '#F3F4F6', fontWeight: '700', fontSize: 18, marginBottom: 8 },
  cardImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, marginBottom: 8 },
  excerpt: { color: '#D1D5DB' },
  footerRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#010102ff',
    paddingTop: 8,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTxt: { color: '#F3F4F6' },
  zoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomImage: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    borderRadius: (SCREEN_WIDTH * 0.9) / 2,
  },
  likesOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  likeBackdrop: { position: 'absolute', width: '100%', height: '100%' },
  likesSheet: {
    backgroundColor: '#010102ff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#181818ff',
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
    borderBottomColor: '#181818ff',
  },
  likesTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '700' },
  likeUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#010102ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#181818ff',
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

// ─── Skeleton styles ──────────────────────────────────────────────────────────
const sk = StyleSheet.create({
  fakeHeader: {
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#181818ff',
  },
  fakeHeaderBack: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#1F1F27',
  },
  fakeHeaderTitle: {
    flex: 1,
    height: 18,
    borderRadius: 6,
    backgroundColor: '#1F1F27',
    marginHorizontal: 16,
  },
  headerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
    gap: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1a1a1aff',
  },
  nameLine: {
    height: 22,
    width: '60%',
    borderRadius: 8,
    backgroundColor: '#1a1a1aff',
  },
  subLine: {
    height: 14,
    width: '30%',
    borderRadius: 6,
    backgroundColor: '#1a1a1aff',
  },
  tabsWrap: {
    flexDirection: 'row',
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
    height: 40,
  },
  tabBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1a1a1aff',
  },
  card: {
    backgroundColor: '#0d0d0dff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#181818ff',
    padding: 12,
    gap: 10,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1a1a1aff',
  },
  cardAuthorLine: {
    height: 12,
    width: '35%',
    borderRadius: 6,
    backgroundColor: '#1a1a1aff',
  },
  cardTitleLine: {
    height: 18,
    width: '70%',
    borderRadius: 6,
    backgroundColor: '#1a1a1aff',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    backgroundColor: '#1a1a1aff',
  },
  cardFooter: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#181818ff',
  },
  cardFooterLine: {
    height: 12,
    width: '40%',
    borderRadius: 6,
    backgroundColor: '#1a1a1aff',
  },
});

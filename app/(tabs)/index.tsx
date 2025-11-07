// app/(tabs)/index.tsx
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl, Modal, ActivityIndicator } from 'react-native';
import { Link, useFocusEffect, useRouter, useNavigation } from 'expo-router';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { supabase } from '../../lib/supabase';
import { like, unlike } from '../../lib/likes';

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
  category: string;
  profiles: { avatar_url: string | null; is_admin: boolean; created_at: string }[] | null;
};

type LikeUser = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
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
  categoryBg: '#1a1a1aff',
  categoryText: '#9CA3AF',
};

export default function Feed() {
  const [stories, setStories] = useState<DBStory[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

  const isLoadedRef = useRef(false); // 👈 CACHÉ CON useRef

  type TabsNav = BottomTabNavigationProp<any>;
  const navigation = useNavigation<TabsNav>();
  const flatListRef = useRef<FlatList<DBStory>>(null);

  async function loadFeed() {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);

    if (uid) {
      const { data: me } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', uid)
        .single<{ avatar_url: string | null }>();
      setUserAvatar(me?.avatar_url ?? null);
    } else {
      setUserAvatar(null);
    }

    const { data: rows, error } = await supabase
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
        category,
        profiles!stories_author_id_fkey ( avatar_url, is_admin, created_at )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn(error.message);
      setStories([]);
      setLikedSet(new Set());
      isLoadedRef.current = true;
      return;
    }

    const rawStories = (rows ?? []) as DBStory[];

    const authorIds = Array.from(new Set(rawStories.map(s => s.author_id)));
    let avatarMap = new Map<string, string | null>();
    if (authorIds.length) {
      const { data: profRows } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', authorIds);
      (profRows ?? []).forEach((p: any) => {
        avatarMap.set(p.id as string, (p.avatar_url ?? null) as string | null);
      });
    }

    const normalized: DBStory[] = rawStories.map(st => {
      const embedded = st.profiles?.[0]?.avatar_url ?? null;
      const fallback =
        (uid && st.author_id === uid ? userAvatar : null) ??
        avatarMap.get(st.author_id) ??
        null;

      if (embedded) return st;
      return { ...st, profiles: [{ avatar_url: fallback, is_admin: st.profiles?.[0]?.is_admin ?? false, created_at: st.profiles?.[0]?.created_at ?? '' }] };
    });

    setStories(normalized);

    if (uid && normalized.length) {
      const ids = normalized.map(r => r.id);
      const { data: likeRows, error: likeErr } = await supabase
        .from('story_likes')
        .select('story_id')
        .eq('user_id', uid)
        .in('story_id', ids);

      if (!likeErr && likeRows) {
        setLikedSet(new Set(likeRows.map(r => r.story_id as string)));
      } else {
        setLikedSet(new Set());
      }
    } else {
      setLikedSet(new Set());
    }

    isLoadedRef.current = true; // 👈 MARCAR COMO CARGADO
  }

  // 👇 CARGA SOLO SI NO ESTÁ EN CACHÉ
  useEffect(() => {
    if (!isLoadedRef.current) {
      loadFeed();
    }
  }, []);

  // 👇 NO RECARGA AL CAMBIAR DE VISTA
  useFocusEffect(useCallback(() => {}, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    isLoadedRef.current = false; // 👈 FUERZA RECARGA
    await loadFeed();
    setRefreshing(false);
  }, []);

  // 👇 SCROLL AL TOP SIN RECARGAR
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
      <FlatList
        ref={flatListRef}
        data={stories}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textPrimary} />}
        renderItem={({ item }) => (
          <StoryCard
            item={item}
            liked={likedSet.has(item.id)}
            onToggleLike={async (id) => {
              const { data: userData } = await supabase.auth.getUser();
              const uid = userData.user?.id;
              if (!uid) return;

              const isLiked = likedSet.has(id);

              try {
                if (isLiked) {
                  await unlike(id);
                  setLikedSet(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                  });
                  setStories(prev =>
                    prev.map(st =>
                      st.id === id ? { ...st, likes_count: Math.max(0, (st.likes_count || 0) - 1) } : st
                    )
                  );
                } else {
                  await like(id);
                  setLikedSet(prev => new Set(prev).add(id));
                  setStories(prev =>
                    prev.map(st =>
                      st.id === id ? { ...st, likes_count: (st.likes_count || 0) + 1 } : st
                    )
                  );
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
    </View>
  );
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'Mitos':
      return <AntDesign name="gitlab" size={12} color={C.categoryText} />;
    case 'Leyenda':
      return <AntDesign name="dingding" size={12} color={C.categoryText} />;
    case 'Urbana':
      return <AntDesign name="heat-map" size={12} color={C.categoryText} />;
    default:
      return null;
  }
}

function StoryCard({
  item,
  liked,
  onToggleLike,
}: {
  item: DBStory;
  liked: boolean;
  onToggleLike: (id: string) => void;
}) {
  const router = useRouter();
  const [isLiking, setIsLiking] = useState(false); // 👈 Estado para bloquear spam
  const [showLikesModal, setShowLikesModal] = useState(false); // 👈 Modal de likes
  const [likeUsers, setLikeUsers] = useState<LikeUser[]>([]); // 👈 Lista de usuarios que dieron like
  const [loadingLikes, setLoadingLikes] = useState(false); // 👈 Cargando likes

  const hasCover = !!item.cover_url;
  const author = item.author_name?.trim() || 'Autor';
  const avatar = item.profiles?.[0]?.avatar_url ?? null;
  const isAdmin = item.profiles?.[0]?.is_admin ?? false;
  const createdAt = item.profiles?.[0]?.created_at ?? '';
  const isEarlyUser = new Date(createdAt) < new Date('2026-01-01');

  const excerpt = useMemo(() => {
    const txt = item.body || '';
    if (txt.length <= 140) return txt;
    return txt.slice(0, 140) + '…';
  }, [item.body]);

  const handleLikePress = async () => {
    if (isLiking) return; // 👈 BLOQUEA SI YA ESTÁ PROCESANDO

    setIsLiking(true); // 👈 DESABILITA EL BOTÓN
    try {
      await onToggleLike(item.id);
    } finally {
      setIsLiking(false); // 👈 REHABILITA DESPUÉS
    }
  };

  // 👇 Función para cargar usuarios que dieron like
  const handleShowLikes = async () => {
    setShowLikesModal(true);
    setLoadingLikes(true);

    try {
      const { data: likes, error } = await supabase
        .from('story_likes')
        .select(`
          user_id,
          profiles!story_likes_user_id_fkey (
            id,
            display_name,
            avatar_url,
            is_admin,
            created_at
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

  const likesCount = item.likes_count ?? 0;
  const commentsCount = item.comments_count ?? 0;

  return (
    <>
      <View style={s.card}>
        <Link href={{ pathname: '/profile/[id]', params: { id: item.author_id } }} asChild>
          <TouchableOpacity activeOpacity={0.85} style={s.headerRow}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, { backgroundColor: C.avatarBg, borderWidth: 1, borderColor: C.avatarBorder, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person-outline" size={14} color={C.textSecondary} />
              </View>
            )}
            {/* 👇 Nombre + insignias */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={s.author}>{author}</Text>
              {isAdmin && <MaterialIcons name="verified" size={16} color="#FFD700" />}
              {isEarlyUser && <MaterialIcons name="verified" size={16} color="#06B6D4" />}
            </View>

            <View style={s.categoryBadge}>
              {getCategoryIcon(item.category)}
              <Text style={s.categoryText}>{item.category}</Text>
            </View>
          </TouchableOpacity>
        </Link>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: '/story/[id]',
              params: {
                id: item.id,
                title: item.title,
                author,
                body: item.body,
                cover: item.cover_url ?? '',
                likes: String(item.likes_count ?? 0),
                comments: String(item.comments_count ?? 0),
                source: 'home',
              },
            })
          }
        >
          <Text style={s.cardTitle}>{item.title}</Text>

          {hasCover && <Image source={{ uri: item.cover_url! }} style={s.cardImg} />}

          <Text style={[s.excerpt, !hasCover && { marginTop: 6 }]}>{excerpt}</Text>

          <View style={s.footerRow}>
            {/* Botón de like */}
            <TouchableOpacity 
              style={s.meta} 
              onPress={handleLikePress} 
              activeOpacity={0.8}
              disabled={isLiking}
            >
              <Ionicons 
                name={liked ? 'heart' : 'heart-outline'} 
                size={20} 
                color={liked ? C.like : C.textSecondary} 
                style={{ opacity: isLiking ? 0.5 : 1 }}
              />
            </TouchableOpacity>

            {/* Contador de likes clickeable */}
            <TouchableOpacity 
              style={[s.metaText, { marginLeft: 4 }]}
              onPress={handleShowLikes}
              activeOpacity={0.8}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[s.metaTxt, liked && { color: C.like }]}>
                {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
              </Text>
            </TouchableOpacity>

            {/* Icono de comentarios */}
            <View style={[s.meta, { marginLeft: 16 }]}>
              <Ionicons name="chatbox-outline" size={20} color={C.textSecondary} />
            </View>

            {/* Contador de comentarios */}
            <View style={[s.metaText, { marginLeft: 4 }]}>
              <Text style={s.metaTxt}>
                {commentsCount} {commentsCount === 1 ? 'Comentario' : 'Comentarios'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* 👇 Modal de likes */}
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
                      <TouchableOpacity
                        style={s.likeUserCard}
                        onPress={() => {
                          setShowLikesModal(false);
                        }}
                      >
                        {user.avatar_url ? (
                          <Image source={{ uri: user.avatar_url }} style={s.likeUserAvatar} />
                        ) : (
                          <View style={[s.likeUserAvatar, { backgroundColor: C.avatarBg, alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="person-outline" size={16} color={C.textSecondary} />
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                          <Text style={s.likeUserName}>{user.display_name || 'Usuario'}</Text>
                          {user.is_admin && <MaterialIcons name="verified" size={14} color="#FFD700" />}
                          {isUserEarly && <MaterialIcons name="verified" size={14} color="#06B6D4" />}
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
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.avatarBg, borderWidth: 1, borderColor: C.avatarBorder },
  author: { color: C.textPrimary, fontWeight: '600' },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.categoryBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  categoryText: {
    color: C.categoryText,
    fontSize: 11,
    fontWeight: '600',
  },
  cardTitle: { color: C.textPrimary, fontWeight: '700', fontSize: 18, marginBottom: 8 },
  cardImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginBottom: 8 },
  excerpt: { color: '#E4E4E7', lineHeight: 20 },
  footerRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 12,
  },
  meta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { flexDirection: 'row', alignItems: 'center' },
  metaTxt: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  // 👇 Estilos para el modal de likes
  likesOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  likeBackdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  likesSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: C.cardBorder,
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
    borderBottomColor: C.cardBorder,
  },
  likesTitle: {
    color: C.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  likeUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 12,
    gap: 12,
  },
  likeUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.avatarBorder,
  },
  likeUserName: {
    color: C.textPrimary,
    fontWeight: '600',
  },
});

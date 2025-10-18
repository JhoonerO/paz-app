// app/(tabs)/index.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, RefreshControl } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

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
  profiles: { avatar_url: string | null }[] | null;
};

export default function Feed() {
  const [stories, setStories] = useState<DBStory[]>([]);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // para fallback de tu propio avatar si el embed viene vacío
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);

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

    // 1) Traer historias + embed (puede venir vacío a veces)
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
        profiles!stories_author_id_fkey ( avatar_url )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn(error.message);
      setStories([]);
      setLikedSet(new Set());
      return;
    }

    const rawStories = (rows ?? []) as DBStory[];

    // 2) Refuerzo: traer avatares en bloque por author_id
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

    // 3) Normalizar: si embed viene vacío, usar avatarMap (o tu propio avatar si es tu post)
    const normalized: DBStory[] = rawStories.map(st => {
      const embedded = st.profiles?.[0]?.avatar_url ?? null;
      const fallback =
        (uid && st.author_id === uid ? userAvatar : null) ??
        avatarMap.get(st.author_id) ??
        null;

      // si ya trae embed válido, lo dejamos; si no, inyectamos fallback
      if (embedded) return st;
      return { ...st, profiles: [{ avatar_url: fallback }] };
    });

    setStories(normalized);

    // 4) Mis likes (para pintar corazón)
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
  }

  useEffect(() => { loadFeed(); }, []);

  useFocusEffect(useCallback(() => { loadFeed(); }, []));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }, []);

  return (
    <View style={s.screen}>
      <FlatList
        data={stories}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F3F4F6" />}
        renderItem={({ item }) => (
          <StoryCard
            item={item}
            liked={likedSet.has(item.id)}
            onToggleLike={async (id) => {
              const { data: userData } = await supabase.auth.getUser();
              const uid = userData.user?.id;
              if (!uid) return;

              const isLiked = likedSet.has(id);
              if (isLiked) {
                const { error } = await supabase
                  .from('story_likes')
                  .delete()
                  .match({ story_id: id, user_id: uid });
                if (!error) {
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
                }
              } else {
                const { error } = await supabase
                  .from('story_likes')
                  .insert({ story_id: id, user_id: uid });
                if (!error) {
                  setLikedSet(prev => new Set(prev).add(id));
                  setStories(prev =>
                    prev.map(st =>
                      st.id === id ? { ...st, likes_count: (st.likes_count || 0) + 1 } : st
                    )
                  );
                }
              }
            }}
          />
        )}
        ListEmptyComponent={<Text style={{ color: '#8A8A93', textAlign: 'center', marginTop: 24 }}>Aún no hay historias.</Text>}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
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
  const hasCover = !!item.cover_url;
  const author = item.author_name?.trim() || 'Autor';
  const avatar = item.profiles?.[0]?.avatar_url ?? null;

  const excerpt = useMemo(() => {
    const txt = item.body || '';
    if (txt.length <= 140) return txt;
    return txt.slice(0, 140) + '…';
  }, [item.body]);

  return (
    <Link
      href={{
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
      }}
      asChild
    >
      <TouchableOpacity activeOpacity={0.85} style={s.card}>
        {/* Autor */}
        <View style={s.headerRow}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: '#374151', borderWidth: 1, borderColor: '#6B7280', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person-outline" size={14} color="#9CA3AF" />
            </View>
          )}
          <Text style={s.author}>{author}</Text>
        </View>

        {/* Título */}
        <Text style={s.cardTitle}>{item.title}</Text>

        {/* Portada solo si existe */}
        {hasCover && <Image source={{ uri: item.cover_url! }} style={s.cardImg} />}

        {/* Extracto siempre visible en el feed */}
        <Text style={[s.excerpt, !hasCover && { marginTop: 6 }]}>{excerpt}</Text>

        {/* Métricas + like */}
        <View style={s.footerRow}>
          <TouchableOpacity style={s.meta} onPress={() => onToggleLike(item.id)} activeOpacity={0.8}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? '#ef4444' : '#F3F4F6'} />
            <Text style={[s.metaTxt, liked && { color: '#ef4444' }]}>{item.likes_count ?? 0}</Text>
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
  card: {
    backgroundColor: '#121219',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1F1F27',
    padding: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#0F1016', borderWidth: 1, borderColor: '#1F1F27' },
  author: { color: '#E5E7EB', fontWeight: '600' },
  cardTitle: { color: '#F3F4F6', fontWeight: '700', fontSize: 18, marginBottom: 8 },
  cardImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, marginBottom: 8 },
  excerpt: { color: '#D1D5DB' },
  footerRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1F1F27',
    paddingTop: 8,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTxt: { color: '#F3F4F6' },
});

// app/profile/[id].tsx
import { useEffect, useLayoutEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useNavigation, useRouter, useLocalSearchParams } from 'expo-router';
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
  profiles: { display_name: string | null; avatar_url: string | null }[] | null;
  liked_at?: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  likes_public: boolean;
};

export default function PublicProfile() {
  const navigation = useNavigation();
  const router = useRouter();
  const { id: profileId } = useLocalSearchParams<{ id: string }>();

  const [displayName, setDisplayName] = useState<string>('Usuario');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [likesPublic, setLikesPublic] = useState<boolean>(true);

  const [tab, setTab] = useState<'mine' | 'likes'>('mine');
  const [stories, setStories] = useState<DBStory[]>([]);
  const [likedStories, setLikedStories] = useState<DBStory[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: 'PAZ',
      headerRight: () => null,
      headerTintColor: '#F3F4F6',
      headerStyle: { backgroundColor: '#121219' },
    });
  }, [navigation]);

  const loadFromSupabase = useCallback(async () => {
    try {
      if (!profileId) return;

      const { data: authData } = await supabase.auth.getUser();
      const uidViewer = authData.user?.id ?? null;
      setViewerId(uidViewer);

      // Perfil visitado
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, likes_public')
        .eq('id', profileId)
        .single<ProfileRow>();
      if (profErr) throw profErr;

      setDisplayName(prof?.display_name || 'Usuario');
      setAvatarUrl(prof?.avatar_url ?? null);
      setLikesPublic(prof?.likes_public ?? true);

      // Historias del usuario visitado
      const { data: mine, error: mineErr } = await supabase
        .from('stories')
        .select(`
          id, title, body, cover_url, likes_count, comments_count, created_at,
          author_id, author_name,
          profiles!stories_author_id_fkey ( display_name, avatar_url )
        `)
        .eq('author_id', profileId)
        .order('created_at', { ascending: false });
      if (mineErr) throw mineErr;

      // ✅ Normaliza 'profiles' (puede venir como objeto o como array)
      const toArray = (p: any) => (Array.isArray(p) ? p : p ? [p] : []);

      const storiesWithAuthor: DBStory[] = (mine ?? []).map((story: any) => {
        const embeddedArr = toArray(story.profiles);
        const current = embeddedArr[0];

        if (!current) {
          // no hay embed: backfill con datos del perfil visitado
          return {
            ...story,
            profiles: [
              {
                display_name: prof?.display_name || story.author_name || 'Autor',
                avatar_url: prof?.avatar_url ?? null,
              },
            ],
          };
        }

        // hay embed pero incompleto: refuerza con datos del perfil visitado
        if (current.avatar_url == null || current.display_name == null) {
          return {
            ...story,
            profiles: [
              {
                display_name: current.display_name ?? prof?.display_name ?? story.author_name ?? 'Autor',
                avatar_url: current.avatar_url ?? prof?.avatar_url ?? null,
              },
            ],
          };
        }

        // embed correcto: garantiza que sea array
        return { ...story, profiles: embeddedArr };
      });
      setStories(storiesWithAuthor);

      // Likes del usuario visitado (si son públicos)
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
              id, title, body, cover_url, likes_count, comments_count, created_at,
              author_id, author_name,
              profiles!stories_author_id_fkey ( display_name, avatar_url )
            `)
            .in('id', ids);
          if (likedErr) throw likedErr;

          const toArray = (p: any) => (Array.isArray(p) ? p : p ? [p] : []);

          likedList = (liked ?? []).map((story: any) => {
            const embeddedArr = toArray(story.profiles);
            let current = embeddedArr[0];

            // base
            let out: DBStory = { ...story, liked_at: likedAtMap.get(story.id) };

            if (!current) {
              out.profiles = [{ display_name: story.author_name || 'Autor', avatar_url: null }];
            } else if (current.avatar_url == null || current.display_name == null) {
              out.profiles = [
                {
                  display_name: current.display_name ?? story.author_name ?? 'Autor',
                  avatar_url: current.avatar_url ?? null,
                },
              ];
            } else {
              out.profiles = embeddedArr;
            }
            return out;
          });

          // Refuerza los avatares con perfiles reales y el del usuario visitado cuando aplique
          const authorIds = Array.from(new Set(likedList.map(s => s.author_id)));
          if (authorIds.length) {
            const { data: authorProfiles } = await supabase
              .from('profiles')
              .select('id, display_name, avatar_url')
              .in('id', authorIds);

            const pMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
            (authorProfiles ?? []).forEach((p: any) => {
              pMap.set(p.id, { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null });
            });

            likedList = likedList.map(st => {
              const current = Array.isArray(st.profiles) ? st.profiles[0] : (st.profiles as any) || null;

              // si el autor es el usuario visitado → usa su avatar/nombre
              if (st.author_id === prof.id) {
                return {
                  ...st,
                  profiles: [
                    {
                      display_name: current?.display_name ?? prof.display_name ?? st.author_name ?? 'Autor',
                      avatar_url: current?.avatar_url ?? prof.avatar_url ?? null,
                    },
                  ],
                };
              }

              const fromMap = pMap.get(st.author_id) ?? null;
              if (!current || current.avatar_url == null || current.display_name == null) {
                return {
                  ...st,
                  profiles: [
                    {
                      display_name: current?.display_name ?? fromMap?.display_name ?? st.author_name ?? 'Autor',
                      avatar_url: current?.avatar_url ?? fromMap?.avatar_url ?? null,
                    },
                  ],
                };
              }
              return st;
            });
          }

          likedList.sort((a, b) => {
            const da = a.liked_at ?? a.created_at;
            const db = b.liked_at ?? b.created_at;
            return db.localeCompare(da);
          });
        }
      }
      setLikedStories(likedList);

      // Likes del visitante (para corazón rojo)
      if (uidViewer) {
        const allIds = [...storiesWithAuthor.map(s => s.id), ...likedList.map(s => s.id)];
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
    }
  }, [profileId]);

  useEffect(() => { loadFromSupabase(); }, [loadFromSupabase]);

  const toggleLike = useCallback(
    async (story: DBStory) => {
      if (!viewerId) return;
      const isLiked = likedIds.has(story.id);

      setLikedIds(prev => {
        const next = new Set(prev);
        if (isLiked) next.delete(story.id);
        else next.add(story.id);
        return next;
      });

      const bump = (arr: DBStory[], id: string, d: number) =>
        arr.map(s => (s.id === id ? { ...s, likes_count: Math.max(0, (s.likes_count || 0) + d) } : s));

      setStories(curr => bump(curr, story.id, isLiked ? -1 : +1));
      setLikedStories(curr => bump(curr, story.id, isLiked ? -1 : +1));

      if (isLiked) {
        const { error } = await supabase.from('story_likes').delete().match({ user_id: viewerId, story_id: story.id });
        if (error) setLikedIds(prev => new Set(prev).add(story.id));
      } else {
        const { error } = await supabase.from('story_likes').insert({ user_id: viewerId, story_id: story.id });
        if (error) setLikedIds(prev => { const n = new Set(prev); n.delete(story.id); return n; });
      }
    },
    [viewerId, likedIds]
  );

  const listData = useMemo(() => (tab === 'mine' ? stories : likedStories), [tab, stories, likedStories]);

  return (
    <View style={s.screen}>
      {/* Avatar + nombre — mismos márgenes; SIN botón de cámara */}
      <View style={s.avatarRow}>
        <View style={s.avatarWrap}>
          {avatarUrl ? <Image source={{ uri: avatarUrl }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: '#0F1016' }]} />}
        </View>
        <Text style={s.name}>{displayName}</Text>
      </View>

      {/* Tabs — mismos estilos */}
      <View style={s.tabs}>
        <TouchableOpacity onPress={() => setTab('mine')} style={[s.tabBtn, tab === 'mine' && s.tabBtnActive]}>
          <Text style={[s.tabTxt, tab === 'mine' && s.tabTxtActive]}>
            {`Mis Historias ${stories.length}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => likesPublic && setTab('likes')}
          style={[s.tabBtn, tab === 'likes' && s.tabBtnActive, !likesPublic && { borderColor: '#374151' }]}
          disabled={!likesPublic}
        >
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
            {tab === 'mine' ? 'Aún no tiene historias.' : (likesPublic ? 'No hay historias en “Me gusta”.' : 'Likes ocultos.')}
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
  );
}

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

  // ✅ Lee el primer profile de forma segura aunque venga como objeto
  const profile0: any = Array.isArray(item.profiles)
    ? item.profiles?.[0]
    : (item.profiles as any) || null;

  const authorForCard =
    item.author_name?.trim() || (profile0?.display_name?.trim() || 'Autor');
  const authorAvatar = profile0?.avatar_url || null;

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
            <View style={[s.avatarMini, { backgroundColor: '#0F1016' }]} />
          )}
          <Text style={s.authorTxt}>{authorForCard}</Text>
        </View>

        <Text style={s.cardTitle}>{item.title}</Text>

        {hasCover && <Image source={{ uri: item.cover_url! }} style={s.cardImg} />}

        {!hasCover && (
          <Text style={s.excerpt} numberOfLines={3}>
            {item.body}
          </Text>
        )}

        <View style={s.footerRow}>
          <TouchableOpacity onPress={onToggleLike} style={s.meta} hitSlop={10} disabled={!viewerId}>
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={16} color={isLiked ? '#EF4444' : '#F3F4F6'} />
            <Text style={[s.metaTxt, isLiked && { color: '#EF4444', fontWeight: '700' }]}>{item.likes_count ?? 0}</Text>
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
});

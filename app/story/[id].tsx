// app/story/[id].tsx
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { like, unlike } from '../../lib/likes';
import { addComment as addCommentService } from '../../lib/comments';
import { createNotification } from '../../lib/notifications';

type Params = {
  id: string;
  title?: string;
  author?: string;
  body?: string;
  cover?: string;
  likes?: string;
  comments?: string;
  source?: 'home' | 'profile' | 'notifications';
};

type Comment = {
  id: string;
  userId: string;          // 👈 para mapear contra profiles
  author: string;
  avatarUrl: string | null;
  text: string;
  createdAt: number;
};

export default function StoryDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, source } = useLocalSearchParams<Params>();

  const storyId = useMemo(() => id ?? String(Date.now()), [id]);

  // ------ estado UI ------
  const [likeCount, setLikeCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentList, setCommentList] = useState<Comment[]>([]);
  const [initialCommentCount, setInitialCommentCount] = useState<number>(0);

  // ------ datos reales de la historia ------
  const [storyTitle, setStoryTitle] = useState<string>('Cargando...');
  const [storyBody, setStoryBody] = useState<string>('Cargando historia...');
  const [storyCover, setStoryCover] = useState<string | undefined>(undefined);
  const [authorName, setAuthorName] = useState<string>('Autor');

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const loadStory = async () => {
      if (!storyId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          title,
          body,
          cover_url,
          likes_count,
          comments_count,
          author_name
        `)
        .eq('id', storyId)
        .maybeSingle();

      if (!error && data) {
        setStoryTitle(data.title || 'Historia');
        setStoryBody(data.body || 'Sin contenido.');
        setStoryCover(data.cover_url || undefined);
        setAuthorName(data.author_name || 'Autor');
        setLikeCount(data.likes_count || 0);
        setInitialCommentCount(data.comments_count || 0);
      } else {
        setStoryTitle('Historia no encontrada');
        setStoryBody('No se pudo cargar esta historia.');
        setAuthorName('Desconocido');
      }
      setLoading(false);
    };

    loadStory();
  }, [storyId]);

  // Verificar estado de like
  useEffect(() => {
    if (!userId || !storyId) return;

    const checkLike = async () => {
      const { data: likeData, error } = await supabase
        .from('story_likes')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!error) {
        setLiked(!!likeData);
      }
    };

    checkLike();
  }, [userId, storyId]);

  // === Cargar comentarios SIN depender del embed ===
  const fetchComments = useCallback(async () => {
    // 1) Trae comentarios con user_id
    const { data: rows, error } = await supabase
      .from('story_comments')
      .select('id, text, created_at, user_id')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false });

    if (error || !rows) {
      setCommentList([]);
      return;
    }

    // 2) Trae perfiles en bloque para esos user_id
    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id))).filter(Boolean);
    let profilesMap = new Map<string, { display_name: string | null; avatar_url: string | null }>();
    if (userIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', userIds);
      (profs ?? []).forEach((p: any) =>
        profilesMap.set(p.id, { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null })
      );
    }

    // 3) Construye la lista final con nombre + avatar
    const comments: Comment[] = rows.map((c: any) => {
      const p = profilesMap.get(c.user_id) || { display_name: null, avatar_url: null };
      return {
        id: c.id,
        userId: c.user_id,
        author: p.display_name || 'Usuario',
        avatarUrl: p.avatar_url ?? null,
        text: c.text,
        createdAt: new Date(c.created_at).getTime(),
      };
    });

    setCommentList(comments);
  }, [storyId]);

  useEffect(() => {
    if (!storyId) return;
    fetchComments();
  }, [storyId, fetchComments]);

  // ---- Acciones ----
  async function toggleLike() {
    if (!userId) {
      alert('Debes iniciar sesión para dar like');
      return;
    }

    const { data: storyData } = await supabase
      .from('stories')
      .select('author_id')
      .eq('id', storyId)
      .maybeSingle();

    const authorId = storyData?.author_id;

    setLiked(prev => {
      const next = !prev;
      setLikeCount(cnt => Math.max(0, cnt + (next ? +1 : -1)));

      if (next) {
        like(storyId).then(() => {
          if (authorId && authorId !== userId) {
            createNotification({ type: 'like', storyId, targetUserId: authorId });
          }
        }).catch(err => {
          console.error('Error al dar like:', err);
          setLiked(false);
          setLikeCount(cnt => Math.max(0, cnt - 1));
        });
      } else {
        unlike(storyId).catch(err => {
          console.error('Error al quitar like:', err);
          setLiked(true);
          setLikeCount(cnt => cnt + 1);
        });
      }

      return next;
    });
  }

  async function addComment() {
    const text = commentInput.trim();
    if (!text) return;

    try {
      await addCommentService(storyId, text);

      const { data: storyData } = await supabase
        .from('stories')
        .select('author_id')
        .eq('id', storyId)
        .maybeSingle();

      const authorId = storyData?.author_id;
      if (authorId && authorId !== userId) {
        createNotification({ type: 'comment', storyId, targetUserId: authorId });
      }

      // Recarga con el mismo flujo (incluye nombre+avatar)
      await fetchComments();
      setCommentInput('');
    } catch (err) {
      console.error('Error al agregar comentario:', err);
      alert('No se pudo guardar el comentario');
    }
  }

  // Back inteligente
  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    switch (source) {
      case 'profile':
        router.replace('/(tabs)/profile');
        break;
      case 'notifications':
        router.replace('/notifications');
        break;
      case 'home':
      default:
        router.replace('/(tabs)');
        break;
    }
  }

  const displayCommentCount = commentList.length || initialCommentCount;
  const HEADER_BAR = 56;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#F3F4F6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F' }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top, height: insets.top + HEADER_BAR }]}>
          <TouchableOpacity onPress={handleBack} hitSlop={10} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>
            {storyTitle}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {storyCover ? <Image source={{ uri: storyCover }} style={s.coverImg} /> : null}

          <Text style={s.bodyText}>{storyBody}</Text>

          <Text style={s.author}>— {authorName}</Text>

          <View style={s.metrics}>
            <TouchableOpacity style={s.iconRow} onPress={toggleLike} activeOpacity={0.8}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={20}
                color={liked ? '#ef4444' : '#F3F4F6'}
              />
              <Text style={[s.metricTxt, liked && { color: '#ef4444' }]}>{likeCount}</Text>
            </TouchableOpacity>

            <View style={s.iconRow}>
              <Ionicons name="chatbubble-outline" size={20} color="#F3F4F6" />
              <Text style={s.metricTxt}>{displayCommentCount}</Text>
            </View>
          </View>

          <View style={{ gap: 8, marginTop: 4 }}>
            {commentList.map(c => (
              <View key={c.id} style={s.commentCard}>
                <View style={s.commentHeader}>
                  {c.avatarUrl ? (
                    <Image source={{ uri: c.avatarUrl }} style={s.commentAvatar} />
                  ) : (
                    <View style={[s.commentAvatar, { backgroundColor: '#374151', borderWidth: 1, borderColor: '#6B7280', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="person-outline" size={14} color="#9CA3AF" />
                    </View>
                  )}
                  <Text style={s.commentAuthor}>{c.author}</Text>
                </View>
                <Text style={s.commentText}>{c.text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={s.inputBar}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#A1A1AA" />
          <TextInput
            placeholder="Agrega un comentario"
            placeholderTextColor="#8A8A93"
            style={s.input}
            value={commentInput}
            onChangeText={setCommentInput}
            returnKeyType="send"
          />
          <TouchableOpacity hitSlop={10} onPress={addComment} disabled={!commentInput.trim()}>
            <Ionicons
              name="send-outline"
              size={20}
              color={commentInput.trim() ? '#F3F4F6' : '#595962'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121219',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F27',
    paddingHorizontal: 12,
  },
  backBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#F3F4F6',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 8,
  },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 90, gap: 12 },
  coverImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12 },
  bodyText: { color: '#E5E7EB', lineHeight: 22, fontSize: 15 },
  author: { color: '#C9C9D1', marginTop: 4, fontStyle: 'italic' },
  metrics: {
    marginTop: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1F1F27',
    flexDirection: 'row',
    gap: 18,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricTxt: { color: '#F3F4F6' },

  commentCard: {
    backgroundColor: '#121219',
    borderWidth: 1,
    borderColor: '#1F1F27',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F1016',
    borderWidth: 1,
    borderColor: '#1F1F27',
  },
  commentAuthor: { color: '#C9C9D1', fontWeight: '600' },
  commentText: { color: '#E5E7EB' },

  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#0B0B0F',
    borderTopWidth: 1,
    borderTopColor: '#1F1F27',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 12,
    color: '#F3F4F6',
    backgroundColor: 'transparent',
  },
});

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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { like, unlike } from '../../lib/likes';
import { addComment as addCommentService } from '../../lib/comments';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

type Params = {
  id: string;
  source?: 'home' | 'profile' | 'notifications';
};

type Comment = {
  id: string;
  userId: string;
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

  const [likeCount, setLikeCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentList, setCommentList] = useState<Comment[]>([]);
  const [initialCommentCount, setInitialCommentCount] = useState<number>(0);
  const [sendingComment, setSendingComment] = useState(false);

  const [storyTitle, setStoryTitle] = useState<string>('Cargando...');
  const [storyBody, setStoryBody] = useState<string>('Cargando historia...');
  const [storyCover, setStoryCover] = useState<string | undefined>(undefined);
  const [authorName, setAuthorName] = useState<string>('Autor');

  const [userId, setUserId] = useState<string | null>(null);
  const [storyAuthorId, setStoryAuthorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [showDeleteStoryModal, setShowDeleteStoryModal] = useState(false);
  const [deletingStory, setDeletingStory] = useState(false);

  // 👇 ESTADO PARA NOTIFICACIONES ELEGANTES (SHEET)
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
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();
      
      setIsAdmin(data?.is_admin ?? false);
    };
    
    if (userId) checkAdmin();
  }, [userId]);

  useEffect(() => {
    const loadStory = async () => {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          title,
          body,
          cover_url,
          likes_count,
          comments_count,
          author_name,
          author_id
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
        setStoryAuthorId(data.author_id || null);
      } else {
        setStoryTitle('Historia no encontrada');
        setStoryBody('No se pudo cargar esta historia.');
        setAuthorName('Desconocido');
      }
      setLoading(false);
    };

    loadStory();
  }, [storyId]);

  const fetchComments = useCallback(async () => {
    const { data: rows } = await supabase
      .from('story_comments')
      .select('id, text, created_at, user_id')
      .eq('story_id', storyId)
      .order('created_at', { ascending: false });

    if (!rows) {
      setCommentList([]);
      return;
    }

    const userIds = Array.from(new Set(rows.map((r: any) => r.user_id))).filter(Boolean);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds);

    const map = new Map(profiles?.map(p => [p.id, p]) ?? []);

    const comments = rows.map((c: any) => ({
      id: c.id,
      userId: c.user_id,
      author: map.get(c.user_id)?.display_name ?? 'Usuario',
      avatarUrl: map.get(c.user_id)?.avatar_url ?? null,
      text: c.text,
      createdAt: new Date(c.created_at).getTime(),
    }));

    setCommentList(comments);
  }, [storyId]);

  useEffect(() => {
    fetchComments();
  }, [storyId, fetchComments]);

  async function handleDeleteComment(commentId: string) {
    try {
      await supabase.from('story_comments').delete().eq('id', commentId);
      setCommentList(prev => prev.filter(c => c.id !== commentId));
      setShowDeleteModal(false);
    } catch {
      setShowDeleteModal(false);
    }
  }

  function confirmDelete(comment: Comment) {
    const canDelete = userId === comment.userId || userId === storyAuthorId;
    if (!canDelete) return;
    setSelectedComment(comment);
    setShowDeleteModal(true);
  }

  async function toggleLike() {
    if (!userId) {
      showNotification(
        'Sesión requerida',
        'Debes iniciar sesión para dar like a las historias.',
        'info'
      );
      return;
    }

    setLiked(prev => !prev);
    setLikeCount(prev => (liked ? prev - 1 : prev + 1));

    if (liked) {
      await unlike(storyId);
    } else {
      await like(storyId);
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
      showNotification(
        'Error',
        'No se pudo guardar el comentario. Intenta de nuevo.',
        'error'
      );
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
      showNotification(
        'Sin permiso',
        'No tienes permiso para eliminar esta historia.',
        'error'
      );
      return;
    }

    setDeletingStory(true);
    try {
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);
      
      if (error) throw error;
      
      setShowDeleteStoryModal(false);
      showNotification(
        'Listo',
        'La historia ha sido eliminada correctamente.',
        'info',
        'Cerrar',
        handleBack
      );
    } catch (error) {
      showNotification(
        'Error',
        'No se pudo eliminar la historia. Intenta de nuevo.',
        'error'
      );
      setDeletingStory(false);
      setShowDeleteStoryModal(false);
    }
  }

  const displayCommentCount = commentList.length || initialCommentCount;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0B0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#F3F4F6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030000ff' }}>
      <View style={[s.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={handleBack} hitSlop={10} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{storyTitle}</Text>
        
        {(userId === storyAuthorId || isAdmin) && (
          <TouchableOpacity 
            onPress={() => setShowDeleteStoryModal(true)} 
            hitSlop={10}
            style={s.deleteBtn}
          >
            <Ionicons name="trash-outline" size={22} color="#ef4444" />
          </TouchableOpacity>
        )}
        
        {!(userId === storyAuthorId || isAdmin) && <View style={{ width: 32 }} />}
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: 80 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {storyCover && <Image source={{ uri: storyCover }} style={s.coverImg} />}

          <Text style={s.bodyText}>{storyBody}</Text>
          <Text style={s.author}>— {authorName}</Text>

          <View style={s.metrics}>
            <TouchableOpacity style={s.iconRow} onPress={toggleLike}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={20}
                color={liked ? '#ef4444' : '#F3F4F6'}
              />
              <Text style={[s.metricTxt, liked && { color: '#ef4444' }]}>{likeCount}</Text>
            </TouchableOpacity>
            <View style={s.iconRow}>
              <FontAwesome5 name="comment-alt" size={20} color="#F3F4F6" />
              <Text style={s.metricTxt}>{displayCommentCount}</Text>
            </View>
          </View>

          <View style={{ gap: 8, marginTop: 4 }}>
            {commentList.map(c => (
              <TouchableOpacity
                key={c.id}
                onLongPress={() => confirmDelete(c)}
                delayLongPress={400}
                activeOpacity={0.9}
              >
                <View style={s.commentCard}>
                  <View style={s.commentHeader}>
                    {c.avatarUrl ? (
                      <Image source={{ uri: c.avatarUrl }} style={s.commentAvatar} />
                    ) : (
                      <View style={[s.commentAvatar, { alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="person-outline" size={14} color="#9CA3AF" />
                      </View>
                    )}
                    <Text style={s.commentAuthor}>{c.author}</Text>
                  </View>
                  <Text style={s.commentText}>{c.text}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View 
          style={[
            s.inputBar, 
            { 
              marginBottom: keyboardHeight,
              paddingBottom: keyboardHeight === 0 ? (insets.bottom > 0 ? insets.bottom : 10) : 10
            }, 
            sendingComment && { opacity: 0.6 }
          ]}
        >
          <FontAwesome5 name="comment-alt" size={18} color="#A1A1AA" />
          <TextInput
            placeholder="Agrega un comentario"
            placeholderTextColor="#dbdbdbff"
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

      {/* Modal eliminar comentario */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Eliminar comentario</Text>
            <Text style={s.modalText}>
              ¿Seguro que quieres eliminar este comentario?
            </Text>

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

      {/* Modal eliminar historia */}
      <Modal visible={showDeleteStoryModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.iconWrapDelete}>
              <Ionicons name="warning" size={28} color="#ef4444" />
            </View>
            
            <Text style={s.modalTitle}>Eliminar historia</Text>
            <Text style={s.modalText}>
              Esta acción no se puede deshacer. ¿Estás seguro de que quieres eliminar esta historia?
            </Text>

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

      {/* 👇 SHEET ELEGANTE PARA NOTIFICACIONES */}
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
                name={sheet.variant === 'error' ? 'alert-circle' : 'checkmark-circle'}
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#030000ff',
    borderBottomWidth: 1,
    borderBottomColor: '#000000ff',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: '#F3F4F6', fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingTop: 10, gap: 12 },
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
    backgroundColor: '#010102ff',
    borderWidth: 1,
    borderColor: '#181818ff',
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
  commentText: { color: '#d0d1d1ff' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: '#030000ff',
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
  
  deleteBtn: { 
    width: 32, 
    height: 32, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
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

  // 👇 ESTILOS DEL SHEET ELEGANTE
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

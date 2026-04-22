// app/chat/[id].tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, ScrollView,
  TouchableOpacity, Platform, KeyboardAvoidingView,
  ActivityIndicator, Animated, Modal, Pressable, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import StoryMessageCard from '../../components/StoryMessageCard';
import { BadgeIcon } from '../profile/settings';
import { getStaticBadges } from '../../lib/badges';
import { getCurrentLevel } from '../../lib/gamification';
import { getScopeBadges } from '../../lib/badgeCache';

// ── Tipo Message actualizado ──────────────────────────────────────────────────
type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read: boolean;
  is_deleted?: boolean;
  edited?: boolean;
  image_url?: string | null;
  type?: 'text' | 'image' | 'story_share';         // ← NUEVO
  story_id?: string | null;                          // ← NUEVO
  story_snapshot?: {                                 // ← NUEVO
    title: string;
    cover_url: string | null;
    author: string;
    author_avatar: string | null;
  } | null;
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function usePulse() {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return opacity;
}

function MessagesSkeleton() {
  const opacity = usePulse();
  const rows = [
    { mine: false, wide: true }, { mine: true, wide: false },
    { mine: true, wide: true }, { mine: false, wide: false },
    { mine: false, wide: true }, { mine: true, wide: true },
  ];
  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      {rows.map((r, i) => (
        <Animated.View key={i} style={[sk.bubbleRow, r.mine ? sk.bubbleRight : sk.bubbleLeft, { opacity }]}>
          {!r.mine && <View style={sk.avatar} />}
          <View style={[sk.bubble, r.wide ? sk.bubbleWide : sk.bubbleNarrow]} />
        </Animated.View>
      ))}
    </View>
  );
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hoy';
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

// ── Pantalla ──────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { id, otherName, otherAvatar, otherUserId, isAdmin, isEarly } =
    useLocalSearchParams<{
      id: string;
      otherName: string;
      otherAvatar: string;
      otherUserId: string;
      isAdmin?: string;
      isEarly?: string;
    }>();

  const isAdminBadge = isAdmin === '1';
  const isEarlyBadge = isEarly === '1';

  const conversationId = id;

  const [myId, setMyId] = useState<string | null>(null);
  const [otherXP, setOtherXP] = useState(0);
  const myIdRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [otherBadges, setOtherBadges] = useState<any[]>([]);

  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editText, setEditText] = useState('');
  const [previewImage, setPreviewImage] = useState<{ uri: string; base64: string } | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { myIdRef.current = myId; }, [myId]);

  // ── Carga inicial ─────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (uid: string) => {
    const [{ data: msgs }, { data: hidden }] = await Promise.all([
      supabase
        .from('messages')
        // ↓ CAMBIO: agregadas las 3 columnas nuevas
        .select('id, sender_id, body, created_at, read, is_deleted, edited, image_url, type, story_id, story_snapshot')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      supabase
        .from('message_hidden')
        .select('message_id')
        .eq('user_id', uid),
    ]);

    if (hidden) setHiddenIds(new Set(hidden.map((h: any) => h.message_id)));

    if (msgs) {
      setMessages(msgs);
      messagesRef.current = msgs;
      setLoading(false);
      await supabase.from('messages').update({ read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', uid).eq('read', false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
    }
  }, [conversationId]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);
      myIdRef.current = user.id;
      await loadMessages(user.id);

      // Cargar XP del otro usuario
      if (otherUserId) {
        supabase.from('user_gamification').select('xp').eq('user_id', otherUserId).maybeSingle()
          .then(({ data: gam }) => setOtherXP(gam?.xp ?? 0));
      }

      // Cargar insignias del otro usuario
      if (otherUserId) {
        const badgesMap = new Map<string, any[]>();
        const { data: assignedBadges } = await supabase
          .from('user_badges')
          .select(`user_id, badges ( id, name, description, color, icon, scope ), granted_at`)
          .eq('user_id', otherUserId)
          .order('granted_at', { ascending: true });
        if (assignedBadges) {
          assignedBadges.forEach((row: any) => {
            const uid = row.user_id;
            const badge = row.badges;
            if (badge) {
              const existing = badgesMap.get(uid) || [];
              existing.push(badge);
              badgesMap.set(uid, existing);
            }
          });
        }
        const otherIsAdmin = isAdmin === '1';
        const chatScopeBadges = await getScopeBadges();
        chatScopeBadges.forEach((badge: any) => {
          if (badge.scope === 'admin_only' && !otherIsAdmin) return;
          const existing = badgesMap.get(otherUserId) || [];
          if (!existing.some((b: any) => b.id === badge.id)) existing.push(badge);
          badgesMap.set(otherUserId, existing);
        });
        setOtherBadges(badgesMap.get(otherUserId) || []);
      }
    };
    init();
  }, [loadMessages]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.getChannels().forEach(ch => supabase.removeChannel(ch));

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' },
        async (payload: any) => {
          const msgData = payload.new || payload.old;
          if (!msgData || msgData.conversation_id !== conversationId) return;

          const uid = myIdRef.current;
          const current = messagesRef.current;

          if (payload.eventType === 'INSERT') {
            const newMsg: Message = payload.new;
            if (current.find(m => m.id === newMsg.id)) return;

            const tempMsg = current.find(m =>
              m.id.startsWith('temp-') &&
              m.sender_id === newMsg.sender_id &&
              (m.body ?? '').trim() === (newMsg.body ?? '').trim()
            );

            if (tempMsg) {
              const updated = current.map(m => m.id === tempMsg.id ? newMsg : m);
              setMessages(updated); messagesRef.current = updated;
            } else if (newMsg.sender_id !== uid) {
              const updated = [...current, newMsg];
              setMessages(updated); messagesRef.current = updated;
              await supabase.from('messages').update({ read: true }).eq('id', newMsg.id);
              setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = current.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m);
            setMessages(updated); messagesRef.current = updated;
          } else if (payload.eventType === 'DELETE') {
            const updated = current.filter(m => m.id !== payload.old.id);
            setMessages(updated); messagesRef.current = updated;
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  // ── Enviar mensaje ────────────────────────────────────────────────────────
  const sendMessage = async (body = text, imageUrl: string | null = null) => {
    const msgBody = body.trim();
    if (!msgBody && !imageUrl) return;
    if (!myId) return;

    setText('');
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: myId,
      body: msgBody,
      created_at: new Date().toISOString(),
      read: false,
      image_url: imageUrl,
      type: 'text',
    };
    const withTemp = [...messagesRef.current, tempMsg];
    setMessages(withTemp); messagesRef.current = withTemp;
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);

    setSending(true);
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: myId,
      body: msgBody,
      image_url: imageUrl,
      type: 'text',
    });

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
    } else {
      await supabase
        .from('conversation_hidden')
        .delete()
        .eq('user_id', myId)
        .eq('conversation_id', conversationId);

      await supabase.from('conversations').update({
        last_message: imageUrl ? '📷 Imagen' : msgBody,
        last_message_at: new Date().toISOString(),
      }).eq('id', conversationId);
    }
    setSending(false);
  };

  // ── Imagen ────────────────────────────────────────────────────────────────
  const handlePickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Error', 'No se pudo leer la imagen.');
      return;
    }

    setPreviewImage({ uri: asset.uri, base64: asset.base64 });
  };

  const handleSendImage = async () => {
    if (!previewImage) return;
    setPreviewImage(null);
    setUploadingImage(true);

    try {
      const fileName = `${conversationId}/${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, decode(previewImage.base64), { contentType: 'image/jpeg' });

      if (error) {
        Alert.alert('Error', 'No se pudo subir la imagen: ' + error.message);
        setUploadingImage(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images').getPublicUrl(fileName);

      await sendMessage('', publicUrl);
    } catch {
      Alert.alert('Error', 'No se pudo enviar la imagen.');
    }
    setUploadingImage(false);
  };

  // ── Acciones mensajes ─────────────────────────────────────────────────────
  const handleLongPress = (msg: Message) => {
    if (msg.is_deleted) return;
    setSelectedMsg(msg);
  };

  const handleEdit = () => {
    if (!selectedMsg) return;
    setEditingMsg(selectedMsg);
    setEditText(selectedMsg.body);
    setSelectedMsg(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMsg || !editText.trim()) return;
    const id = editingMsg.id;
    setEditingMsg(null);
    try {
      await supabase.from('messages').update({
        body: editText.trim(), edited: true,
      }).eq('id', id);
    } catch {}
    setEditText('');
  };

  const handleDeleteForAll = async () => {
    if (!selectedMsg) return;
    const id = selectedMsg.id;
    setSelectedMsg(null);
    try {
      await supabase.from('messages').update({
        is_deleted: true, body: 'Mensaje eliminado',
      }).eq('id', id);
    } catch {}
  };

  const handleDeleteForMe = async () => {
    if (!selectedMsg || !myId) return;
    const id = selectedMsg.id;
    setSelectedMsg(null);
    setHiddenIds(prev => new Set([...prev, id]));
    try {
      await supabase.from('message_hidden').upsert({ user_id: myId, message_id: id });
    } catch {}
  };

  const handleDeleteConversation = async () => {
    setShowChatMenu(false);
    if (!myId) return;

    const allIds = messagesRef.current
      .filter(m => !hiddenIds.has(m.id))
      .map(m => ({ user_id: myId, message_id: m.id }));

    try {
      if (allIds.length > 0) {
        await supabase.from('message_hidden').upsert(allIds);
      }
      await supabase.from('conversation_hidden').upsert({
        user_id: myId,
        conversation_id: conversationId,
      });
    } catch {}

    setHiddenIds(prev => new Set([...prev, ...messagesRef.current.map(m => m.id)]));
    router.back();
  };

  // ── FlatList data ─────────────────────────────────────────────────────────
  type FlatItem =
    | { kind: 'label'; label: string; key: string }
    | { kind: 'msg'; msg: Message };

  const flatItems: FlatItem[] = [];
  let currentLabel = '';
  for (const msg of messages) {
    if (hiddenIds.has(msg.id)) continue;
    const label = formatDateLabel(msg.created_at);
    if (label !== currentLabel) {
      flatItems.push({ kind: 'label', label, key: `label-${msg.id}` });
      currentLabel = label;
    }
    flatItems.push({ kind: 'msg', msg });
  }

  return (
    <SafeAreaView style={s.screen} edges={['bottom']}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={s.headerAvatar} />
          ) : (
            <View style={[s.headerAvatar, s.avatarPlaceholder]}>
              <Ionicons name="person-outline" size={16} color="#9CA3AF" />
            </View>
          )}
          <Link
            href={{
              pathname: '/profile/[id]',
              params: { id: otherUserId, source: 'chat' },
            }}
            asChild
          >
            <TouchableOpacity style={s.headerNameRow} activeOpacity={0.8}>
              <Text style={s.headerName} numberOfLines={1}>{otherName}</Text>
              {getStaticBadges(isAdminBadge, isEarlyBadge ? '2025-01-01' : '2026-06-01').map((b) => (
                <BadgeIcon key={b.id} iconKey={b.icon} size={14} color={b.color} />
              ))}
              <MaterialCommunityIcons name={getCurrentLevel(otherXP).icon as any} size={14} color={getCurrentLevel(otherXP).color} />
            </TouchableOpacity>
          </Link>
        </View>
        <TouchableOpacity hitSlop={10} style={s.iconBtn} onPress={() => setShowChatMenu(true)}>
          <Ionicons name="ellipsis-vertical" size={22} color="#F3F4F6" />
        </TouchableOpacity>
      </View>

      {/* Area de mensajes con input abajo */}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#000' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? <MessagesSkeleton /> : (
          <FlatList
            ref={flatListRef}
            data={flatItems}
            keyExtractor={(item) => item.kind === 'label' ? item.key : item.msg.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={s.emptyState}>
                <View style={s.emptyIconWrap}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#2C2C33" />
                </View>
                <Text style={s.emptyTitle}>Aún no hay mensajes</Text>
                <Text style={s.emptySubtitle}>
                  Sé el primero en romper el silencio 👻{'\n'}escribe algo para empezar
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.kind === 'label') {
                return (
                  <View style={s.dateLabelWrap}>
                    <Text style={s.dateLabelTxt}>{item.label}</Text>
                  </View>
                );
              }

              const msg = item.msg;
              const isMine = msg.sender_id === myId;
              const isTemp = msg.id.startsWith('temp-');
              const isDeleted = !!msg.is_deleted;

              // ── NUEVO: historia compartida ──────────────────────────────
              if (msg.type === 'story_share') {
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onLongPress={() => handleLongPress(msg)}
                    delayLongPress={300}
                    style={[s.msgRow, isMine ? s.msgRowRight : s.msgRowLeft]}
                  >
                    {!isMine && (
                      otherAvatar
                        ? <Image source={{ uri: otherAvatar }} style={s.msgAvatar} />
                        : <View style={[s.msgAvatar, s.avatarPlaceholder]} />
                    )}
                    <StoryMessageCard
                      storyId={msg.story_id ?? null}
                      snapshot={msg.story_snapshot ?? null}
                      isDeleted={isDeleted}
                    />
                  </TouchableOpacity>
                );
              }
              // ── FIN NUEVO ───────────────────────────────────────────────

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onLongPress={() => handleLongPress(msg)}
                  delayLongPress={300}
                  style={[s.msgRow, isMine ? s.msgRowRight : s.msgRowLeft]}
                >
                  {!isMine && (
                    otherAvatar
                      ? <Image source={{ uri: otherAvatar }} style={s.msgAvatar} />
                      : <View style={[s.msgAvatar, s.avatarPlaceholder]} />
                  )}
                  <View style={[
                    s.bubble,
                    isMine ? s.bubbleMine : s.bubbleOther,
                    isTemp && { opacity: 0.6 },
                    isDeleted && s.bubbleDeleted,
                    msg.image_url && !msg.body && { padding: 4 },
                  ]}>
                    {msg.image_url && !isDeleted && (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => setZoomImageUrl(msg.image_url!)}>
                        <Image source={{ uri: msg.image_url }} style={s.msgImage} contentFit="cover" />
                      </TouchableOpacity>
                    )}
                    {(msg.body || isDeleted) && (
                      <Text style={[s.bubbleTxt, isDeleted && s.deletedTxt]}>
                        {isDeleted ? '🚫 Mensaje eliminado' : msg.body}
                      </Text>
                    )}
                    {msg.edited && !isDeleted && (
                      <Text style={s.editedTxt}>editado</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ── Input / Modo edición ──────────────────────────────────────── */}
        {editingMsg ? (
          <View style={s.inputRow}>
            <TouchableOpacity style={s.attachBtn} hitSlop={10}
              onPress={() => { setEditingMsg(null); setEditText(''); }}>
              <Ionicons name="close-outline" size={22} color="#ef4444" />
            </TouchableOpacity>
            <TextInput
              style={s.input} value={editText} onChangeText={setEditText}
              autoFocus multiline placeholder="Editar mensaje..."
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={[s.sendBtn, !editText.trim() && { opacity: 0.4 }]}
              onPress={handleSaveEdit} disabled={!editText.trim()} hitSlop={10}
            >
              <Ionicons name="checkmark" size={22} color="#F3F4F6" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.inputRow}>
            <TouchableOpacity style={s.attachBtn} hitSlop={10}
              onPress={handlePickImage} disabled={uploadingImage}>
              {uploadingImage
                ? <ActivityIndicator size="small" color="#9CA3AF" />
                : <Ionicons name="image-outline" size={22} color="#9CA3AF" />
              }
            </TouchableOpacity>
            <TextInput
              style={s.input} placeholder="Escribir mensaje..."
              placeholderTextColor="#9CA3AF" value={text} onChangeText={setText}
              multiline returnKeyType="send" onSubmitEditing={() => sendMessage()}
            />
            <TouchableOpacity
              style={[s.sendBtn, !text.trim() && { opacity: 0.4 }]}
              onPress={() => sendMessage()} disabled={!text.trim() || sending} hitSlop={10}
            >
              {sending
                ? <ActivityIndicator size="small" color="#F3F4F6" />
                : <Ionicons name="send" size={20} color="#F3F4F6" />
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── Preview imagen ────────────────────────────────────────────────── */}
      <Modal visible={!!previewImage} transparent animationType="fade"
        onRequestClose={() => setPreviewImage(null)}>
        <View style={s.previewOverlay}>
          <Image
            source={{ uri: previewImage?.uri }}
            style={s.previewImg}
            contentFit="contain"
          />
          <View style={s.previewActions}>
            <TouchableOpacity style={s.previewCancel} onPress={() => setPreviewImage(null)}>
              <Ionicons name="close" size={26} color="#F3F4F6" />
              <Text style={s.previewBtnTxt}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.previewSend} onPress={handleSendImage}>
              <Ionicons name="send" size={20} color="#F3F4F6" />
              <Text style={s.previewBtnTxt}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Action sheet — opciones del mensaje ──────────────────────────── */}
      <Modal
        visible={!!selectedMsg} transparent animationType="slide"
        onRequestClose={() => setSelectedMsg(null)}
      >
        <Pressable style={s.overlay} onPress={() => setSelectedMsg(null)}>
          <View style={[s.actionSheet, { paddingBottom: insets.bottom + 8 }]}>
            {selectedMsg?.sender_id === myId && selectedMsg?.type !== 'story_share' && (
              <>
                <TouchableOpacity style={s.actionRow} onPress={handleEdit}>
                  <Ionicons name="pencil-outline" size={20} color="#F3F4F6" />
                  <Text style={s.actionTxt}>Editar</Text>
                </TouchableOpacity>
                <View style={s.actionDivider} />
              </>
            )}
            {selectedMsg?.sender_id === myId && (
              <>
                <TouchableOpacity style={s.actionRow} onPress={handleDeleteForAll}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  <Text style={[s.actionTxt, { color: '#ef4444' }]}>Borrar para todos</Text>
                </TouchableOpacity>
                <View style={s.actionDivider} />
              </>
            )}
            <TouchableOpacity style={s.actionRow} onPress={handleDeleteForMe}>
              <Ionicons name="eye-off-outline" size={20} color="#F87171" />
              <Text style={[s.actionTxt, { color: '#F87171' }]}>Borrar solo para mí</Text>
            </TouchableOpacity>
            <View style={s.actionDivider} />
            <TouchableOpacity style={s.actionRow} onPress={() => setSelectedMsg(null)}>
              <Ionicons name="close-outline" size={20} color="#9CA3AF" />
              <Text style={[s.actionTxt, { color: '#9CA3AF' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Zoom imagen ──────────────────────────────────────────────────── */}
      <Modal
        visible={!!zoomImageUrl} transparent animationType="fade"
        onRequestClose={() => setZoomImageUrl(null)}
        statusBarTranslucent
      >
        <View style={s.zoomOverlay}>
          <TouchableOpacity style={s.zoomClose} onPress={() => setZoomImageUrl(null)} hitSlop={12}>
            <Ionicons name="close" size={28} color="#F3F4F6" />
          </TouchableOpacity>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.zoomScrollContent}
            maximumZoomScale={4}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
          >
            <Image
              source={{ uri: zoomImageUrl ?? undefined }}
              style={s.zoomImage}
              contentFit="contain"
            />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Chat menu — tres puntos ───────────────────────────────────────── */}
      <Modal
        visible={showChatMenu} transparent animationType="slide"
        onRequestClose={() => setShowChatMenu(false)}
      >
        <Pressable style={s.overlay} onPress={() => setShowChatMenu(false)}>
          <View style={[s.actionSheet, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={s.actionRow} onPress={handleDeleteConversation}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[s.actionTxt, { color: '#ef4444' }]}>Borrar conversación</Text>
            </TouchableOpacity>
            <View style={s.actionDivider} />
            <TouchableOpacity style={s.actionRow} onPress={() => setShowChatMenu(false)}>
              <Ionicons name="close-outline" size={20} color="#9CA3AF" />
              <Text style={[s.actionTxt, { color: '#9CA3AF' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  header: {
    backgroundColor: '#000', borderBottomWidth: 1,
    borderBottomColor: '#181818ff', flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 8,
  },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  avatarPlaceholder: {
    backgroundColor: '#0F1016', borderWidth: 1, borderColor: '#2C2C33',
    alignItems: 'center', justifyContent: 'center',
  },
  headerName: { color: '#F3F4F6', fontWeight: '700', fontSize: 15 },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  dateLabelWrap: {
    alignSelf: 'center', backgroundColor: '#1a1a1aff',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginVertical: 12,
  },
  dateLabelTxt: { color: '#9CA3AF', fontSize: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, gap: 8 },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRight: { justifyContent: 'flex-end' },
  msgAvatar: { width: 30, height: 30, borderRadius: 15 },
  bubble: {
    maxWidth: '75%', borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden',
  },
  bubbleOther: { backgroundColor: '#1a1a1aff', borderBottomLeftRadius: 4 },
  bubbleMine: { backgroundColor: '#2a2a2aff', borderBottomRightRadius: 4 },
  bubbleDeleted: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a' },
  msgImage: { width: 200, height: 200, borderRadius: 12 },
  bubbleTxt: { color: '#F3F4F6', fontSize: 14, lineHeight: 20 },
  deletedTxt: { color: '#6B7280', fontStyle: 'italic', fontSize: 13 },
  editedTxt: { color: '#6B7280', fontSize: 11, marginTop: 2, alignSelf: 'flex-end' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#181818ff', gap: 8,
  },
  attachBtn: { paddingBottom: 10 },
  input: {
    flex: 1, backgroundColor: '#0f0f0fff', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    color: '#F3F4F6', fontSize: 14, maxHeight: 100,
  },
  sendBtn: { paddingBottom: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: '#010102ff', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, borderTopWidth: 1,
    borderColor: '#181818ff', paddingTop: 8,
  },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 20, paddingVertical: 16,
  },
  actionTxt: { color: '#F3F4F6', fontSize: 16, fontWeight: '500' },
  actionDivider: { height: 1, backgroundColor: '#181818ff', marginHorizontal: 20 },
  previewOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  previewImg: { width: '90%', height: '70%', borderRadius: 12 },
  previewActions: { flexDirection: 'row', gap: 24, marginTop: 28 },
  previewCancel: {
    alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: '#2C2C33', backgroundColor: '#0F1016',
  },
  previewSend: {
    alignItems: 'center', gap: 6, flexDirection: 'row',
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 12, backgroundColor: '#2a2a2aff',
    borderWidth: 1, borderColor: '#3a3a3a',
  },
  previewBtnTxt: { color: '#F3F4F6', fontWeight: '600', fontSize: 15 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#0f0f0fff', borderWidth: 1, borderColor: '#1f1f1fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { color: '#F3F4F6', fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: '#6B7280', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  zoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  zoomClose: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 6,
  },
  zoomScrollContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  zoomImage: { width: '100%', aspectRatio: 1 },
});

const sk = StyleSheet.create({
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleLeft: { justifyContent: 'flex-start' },
  bubbleRight: { justifyContent: 'flex-end' },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1a1a1aff' },
  bubble: { height: 40, borderRadius: 16, backgroundColor: '#1a1a1aff' },
  bubbleWide: { width: '65%' },
  bubbleNarrow: { width: '35%' },
});

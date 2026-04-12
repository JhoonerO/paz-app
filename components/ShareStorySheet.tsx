import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, FlatList,
  TouchableOpacity, Modal, Pressable, Share,
  ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export type StoryShareData = {
  id: string;
  title: string;
  cover_url: string | null;
  author: string;
  author_avatar: string | null;
};

type ConvItem = {
  id: string;
  otherUserId: string;
  otherName: string;
  otherAvatar: string | null;
  isAdmin: boolean;
  isEarly: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  story: StoryShareData;
  currentUserId: string;
};

export default function ShareStorySheet({ visible, onClose, story, currentUserId }: Props) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<ConvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('conversations')
      .select('id, user1_id, user2_id, last_message_at')
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
      .order('last_message_at', { ascending: false });

    if (error || !data) { setLoading(false); return; }

    const otherIds = data.map((c: any) =>
      c.user1_id === currentUserId ? c.user2_id : c.user1_id
    );

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, is_admin, created_at')
      .in('id', otherIds);

    const profileMap = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));

    const mapped: ConvItem[] = data.map((c: any) => {
      const otherId = c.user1_id === currentUserId ? c.user2_id : c.user1_id;
      const profile = profileMap.get(otherId);
      const isEarly = profile?.created_at
        ? new Date(profile.created_at) < new Date('2026-01-01')
        : false;
      return {
        id: c.id,
        otherUserId: otherId,
        otherName: profile?.display_name ?? 'Usuario',
        otherAvatar: profile?.avatar_url ?? null,
        isAdmin: profile?.is_admin ?? false,
        isEarly,
      };
    });

    setConversations(mapped);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    if (visible) {
      loadConversations();
      setSentIds(new Set());
      setShowAll(false);
    }
  }, [visible, loadConversations]);

  const sendToConversation = async (conv: ConvItem) => {
    if (sending || sentIds.has(conv.id)) return;
    setSending(conv.id);

    const { error } = await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: currentUserId,
      body: `📖 ${story.title}`,
      type: 'story_share',
      story_id: story.id,
      story_snapshot: {
        title: story.title,
        cover_url: story.cover_url,
        author: story.author,
        author_avatar: story.author_avatar,
      },
    });

    if (!error) {
      await Promise.all([
        supabase.from('conversations').update({
          last_message: `📖 ${story.title}`,
          last_message_at: new Date().toISOString(),
        }).eq('id', conv.id),
        supabase
          .from('conversation_hidden')
          .delete()
          .eq('user_id', currentUserId)
          .eq('conversation_id', conv.id),
      ]);
      setSentIds(prev => new Set([...prev, conv.id]));
    } else {
      Alert.alert('Error', 'No se pudo compartir la historia.');
    }
    setSending(null);
  };


const handleExternalShare = async () => {
  try {
    await Share.share({
      title: story.title,
      message: `"${story.title}" — Historia de ${story.author} en U-PAZ\n\nAbre aquí: upaz://story/${story.id}`,
      url: `upaz://story/${story.id}`, // iOS lo usa aparte del message
    });
  } catch (_) {}
};


  const renderConvRow = (conv: ConvItem) => {
    const isSent = sentIds.has(conv.id);
    const isSending = sending === conv.id;
    return (
      <View key={conv.id} style={sh.convRow}>
        {conv.otherAvatar ? (
          <Image source={{ uri: conv.otherAvatar }} style={sh.convAvatar} />
        ) : (
          <View style={[sh.convAvatar, sh.convAvatarPlaceholder]}>
            <Ionicons name="person-outline" size={18} color="#9CA3AF" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={sh.convName} numberOfLines={1}>{conv.otherName}</Text>
            {conv.isAdmin && <MaterialIcons name="verified" size={13} color="#FFD700" />}
            {conv.isEarly && <MaterialIcons name="verified" size={13} color="#06B6D4" />}
          </View>
        </View>
        <TouchableOpacity
          style={[sh.sendBtn, isSent && sh.sendBtnSent]}
          onPress={() => sendToConversation(conv)}
          disabled={isSent || !!sending}
          activeOpacity={0.8}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#F3F4F6" />
          ) : isSent ? (
            <Ionicons name="checkmark" size={16} color="#22C55E" />
          ) : (
            <Text style={sh.sendBtnTxt}>Enviar</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const recent = conversations.slice(0, 3);

  return (
    <>
      {/* ── Sheet principal ──────────────────────────────────────────────── */}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={sh.overlay} onPress={onClose}>
          <Pressable style={[sh.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => {}}>
            <View style={sh.handle} />

            {/* Preview de la historia */}
            <View style={sh.storyPreview}>
              {story.cover_url ? (
                <Image source={{ uri: story.cover_url }} style={sh.storyCover} resizeMode="cover" />
              ) : (
                <View style={[sh.storyCover, sh.storyCoverPlaceholder]}>
                  <Ionicons name="book-outline" size={22} color="#4B5563" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={sh.storyTitle} numberOfLines={2}>{story.title}</Text>
                <Text style={sh.storyAuthor} numberOfLines={1}>por {story.author}</Text>
              </View>
            </View>

            <View style={sh.divider} />

            {/* Compartir externamente */}
            <TouchableOpacity style={sh.externalBtn} onPress={handleExternalShare} activeOpacity={0.8}>
              <View style={sh.externalIcon}>
                <Ionicons name="share-outline" size={20} color="#F3F4F6" />
              </View>
              <Text style={sh.externalTxt}>Compartir fuera de la app</Text>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </TouchableOpacity>

            <View style={sh.divider} />

            {/* Conversaciones recientes */}
            <Text style={sh.sectionTitle}>Enviar a</Text>

            {loading ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color="#6B7280" />
              </View>
            ) : conversations.length === 0 ? (
              <Text style={sh.emptyTxt}>No tienes conversaciones aún</Text>
            ) : (
              <>
                {recent.map(conv => renderConvRow(conv))}
                {conversations.length > 3 && (
                  <TouchableOpacity
                    style={sh.seeMoreBtn}
                    onPress={() => setShowAll(true)}
                    activeOpacity={0.8}
                  >
                    <View style={sh.seeMoreIcon}>
                      <Ionicons name="people-outline" size={20} color="#F3F4F6" />
                    </View>
                    <Text style={sh.seeMoreTxt}>Ver más personas</Text>
                    <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Modal — todas las conversaciones ────────────────────────────── */}
      <Modal visible={showAll} transparent animationType="slide" onRequestClose={() => setShowAll(false)}>
        <Pressable style={sh.overlay} onPress={() => setShowAll(false)}>
          <Pressable style={[sh.allSheet, { paddingBottom: insets.bottom + 8 }]} onPress={() => {}}>
            <View style={sh.handle} />
            <View style={sh.allHeader}>
              <Text style={sh.allTitle}>Enviar a</Text>
              <TouchableOpacity onPress={() => setShowAll(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#F3F4F6" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
              ItemSeparatorComponent={() => (
                <View style={{ height: 1, backgroundColor: '#181818ff', marginLeft: 56 }} />
              )}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => renderConvRow(item)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const sh = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#010102ff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: '#181818ff',
    paddingTop: 12, paddingHorizontal: 16,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: '#3F3F46', alignSelf: 'center', marginBottom: 16,
  },
  storyPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  storyCover: { width: 56, height: 56, borderRadius: 8 },
  storyCoverPlaceholder: {
    backgroundColor: '#1a1a1aff', alignItems: 'center', justifyContent: 'center',
  },
  storyTitle: { color: '#F3F4F6', fontWeight: '700', fontSize: 14, lineHeight: 20 },
  storyAuthor: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#181818ff', marginVertical: 12 },
  externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  externalIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1a1a1aff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2C2C33',
  },
  externalTxt: { flex: 1, color: '#F3F4F6', fontSize: 15, fontWeight: '600' },
  sectionTitle: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  emptyTxt: { color: '#6B7280', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  convRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingVertical: 8,
  },
  convAvatar: { width: 44, height: 44, borderRadius: 22 },
  convAvatarPlaceholder: {
    backgroundColor: '#0F1016', borderWidth: 1, borderColor: '#2C2C33',
    alignItems: 'center', justifyContent: 'center',
  },
  convName: { color: '#F3F4F6', fontSize: 14, fontWeight: '600' },
  sendBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#1a1a1aff', borderWidth: 1, borderColor: '#2C2C33',
    minWidth: 72, alignItems: 'center', justifyContent: 'center', height: 34,
  },
  sendBtnSent: { borderColor: '#166534', backgroundColor: '#052e16' },
  sendBtnTxt: { color: '#F3F4F6', fontSize: 13, fontWeight: '600' },
  seeMoreBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  seeMoreIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1a1a1aff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2C2C33',
  },
  seeMoreTxt: { flex: 1, color: '#F3F4F6', fontSize: 14, fontWeight: '600' },
  allSheet: {
    backgroundColor: '#010102ff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: '#181818ff',
    paddingTop: 12, maxHeight: '75%',
  },
  allHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#181818ff',
  },
  allTitle: { color: '#F3F4F6', fontSize: 17, fontWeight: '700' },
});

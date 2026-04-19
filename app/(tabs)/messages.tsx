// app/(tabs)/messages.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, FlatList,
  TouchableOpacity, TextInput, Animated, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BadgeIcon } from '../profile/settings';
import { getStaticBadges } from '../../lib/badges';
import { getCurrentLevel } from '../../lib/gamification';

type ConversationItem = {
  id: string;
  otherUserId: string;
  otherName: string;
  otherAvatar: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isAdmin: boolean;
  isEarly: boolean;
  otherXP: number;
  otherBadges?: any[];
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

function ConversationSkeleton({ opacity }: { opacity: Animated.Value }) {
  return (
    <Animated.View style={[sk.row, { opacity }]}>
      <View style={sk.avatar} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={sk.nameLine} />
        <View style={sk.previewLine} />
      </View>
      <View style={sk.badge} />
    </Animated.View>
  );
}

function SkeletonList() {
  const opacity = usePulse();
  return (
    <>
      {[...Array(7)].map((_, i) => (
        <ConversationSkeleton key={i} opacity={opacity} />
      ))}
    </>
  );
}

// ── Pantalla ──────────────────────────────────────────────────────────────────
export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [hiddenConvIds, setHiddenConvIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);

  // Modal long press
  const [selectedConv, setSelectedConv] = useState<ConversationItem | null>(null);

  const loadConversations = useCallback(async (uid: string) => {
    const [{ data, error }, { data: hidden }] = await Promise.all([
      supabase
        .from('conversations')
        .select('id, user1_id, user2_id, last_message, last_message_at')
        .or(`user1_id.eq.${uid},user2_id.eq.${uid}`)
        .order('last_message_at', { ascending: false }),
      supabase
        .from('conversation_hidden')
        .select('conversation_id')
        .eq('user_id', uid),
    ]);

    // ✅ Cargar ocultas primero para evitar flash
    if (hidden) {
      setHiddenConvIds(new Set(hidden.map((h: any) => h.conversation_id)));
    }

    if (error || !data) { setLoading(false); return; }

    const otherIds = data.map((c: any) =>
      c.user1_id === uid ? c.user2_id : c.user1_id
    );

    const [{ data: profiles }, { data: xpRows }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_url, is_admin, created_at').in('id', otherIds),
      supabase.from('user_gamification').select('user_id, xp').in('user_id', otherIds),
    ]);

    const profileMap = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => profileMap.set(p.id, p));
    const xpMap = new Map<string, number>();
    (xpRows ?? []).forEach((r: any) => xpMap.set(r.user_id, r.xp ?? 0));

    const unreadResults = await Promise.all(
      data.map((c: any) =>
        supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .eq('read', false)
          .neq('sender_id', uid)
      )
    );

    const mapped: ConversationItem[] = data.map((c: any, i: number) => {
    const otherId = c.user1_id === uid ? c.user2_id : c.user1_id;
    const profile = profileMap.get(otherId);
    const isEarly =
      profile?.created_at ? new Date(profile.created_at) < new Date('2026-01-01') : false;

    return {
      id: c.id,
      otherUserId: otherId,
      otherName: profile?.display_name ?? 'Usuario',
      otherAvatar: profile?.avatar_url ?? null,
      lastMessage: c.last_message ?? null,
      lastMessageAt: c.last_message_at ?? null,
      unreadCount: unreadResults[i].count ?? 0,
      isAdmin: profile?.is_admin ?? false,
      isEarly,
      otherXP: xpMap.get(otherId) ?? 0,
      otherBadges: [],
    };
  });

    // Cargar insignias de los otros usuarios
    if (otherIds.length) {
      const badgesMap = new Map<string, any[]>();
      const { data: assignedBadges } = await supabase
        .from('user_badges')
        .select(`user_id, badges ( id, name, description, color, icon, scope ), granted_at`)
        .in('user_id', otherIds)
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
      const { data: scopeBadges } = await supabase
        .from('badges')
        .select('id, name, description, color, icon, scope')
        .order('name', { ascending: true });
      (scopeBadges || []).forEach((badge: any) => {
        if (badge.scope === 'all_users') {
          otherIds.forEach((oid) => {
            const existing = badgesMap.get(oid) || [];
            if (!existing.some((b: any) => b.id === badge.id)) {
              existing.push(badge);
              badgesMap.set(oid, existing);
            }
          });
        } else if (badge.scope === 'admin_only') {
          otherIds.forEach((oid) => {
            const p = profileMap.get(oid);
            if (p?.is_admin) {
              const existing = badgesMap.get(oid) || [];
              if (!existing.some((b: any) => b.id === badge.id)) {
                existing.push(badge);
                badgesMap.set(oid, existing);
              }
            }
          });
        }
      });
      // Asignar badges
      mapped.forEach((conv) => {
        conv.otherBadges = badgesMap.get(conv.otherUserId) || [];
      });
    }


    setConversations(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setMyId(user.id);
      await loadConversations(user.id);
    };
    init();
  }, [loadConversations]);

  useFocusEffect(
    useCallback(() => {
      if (myId) loadConversations(myId);
    }, [myId, loadConversations])
  );

  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`conversations-${myId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversations',
        filter: `user1_id=eq.${myId}`,
      }, () => loadConversations(myId))
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversations',
        filter: `user2_id=eq.${myId}`,
      }, () => loadConversations(myId))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, () => loadConversations(myId))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [myId, loadConversations]);

  // ── Borrar conversación solo para mí ─────────────────────────────────────
  const handleDeleteConversation = async () => {
    if (!selectedConv || !myId) return;
    const convId = selectedConv.id;
    setSelectedConv(null);

    // Ocultar todos los mensajes de esa conv para mí
    const { data: msgs } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', convId);

    if (msgs && msgs.length > 0) {
      await supabase.from('message_hidden').upsert(
        msgs.map((m: any) => ({ user_id: myId, message_id: m.id }))
      );
    }

    // ✅ Ocultar la conversación del listado
    await supabase.from('conversation_hidden').upsert({
      user_id: myId,
      conversation_id: convId,
    });

    // Actualizar estado local inmediatamente
    setHiddenConvIds(prev => new Set([...prev, convId]));
  };

  // ✅ Filtrar ocultas + búsqueda
  const filtered = conversations.filter((c) =>
    !hiddenConvIds.has(c.id) &&
    c.otherName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={s.screen} edges={['bottom']}>
      {/* Búsqueda */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          placeholder="Buscar conversaciones..."
          placeholderTextColor="#9CA3AF"
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="chatbubbles-outline" size={56} color="#3F3F46" />
              <Text style={s.emptyTxt}>Sin conversaciones aún</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              activeOpacity={0.7}
              delayLongPress={350}
              onLongPress={() => setSelectedConv(item)} // ✅ long press
              onPress={() =>
                router.push({
                  pathname: '/chat/[id]',
                  params: {
                    id: item.id,
                    otherName: item.otherName,
                    otherAvatar: item.otherAvatar ?? '',
                    otherUserId: item.otherUserId,
                    isAdmin: item.isAdmin ? '1' : '0',
                    isEarly: item.isEarly ? '1' : '0',
                  },

                })
              }
            >
              {item.otherAvatar ? (
                <Image source={{ uri: item.otherAvatar }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarPlaceholder]}>
                  <Ionicons name="person-outline" size={22} color="#9CA3AF" />
                </View>
              )}

              <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={s.name} numberOfLines={1}>{item.otherName}</Text>
              {getStaticBadges(item.isAdmin, item.isEarly ? '2025-01-01' : '2026-06-01').map((b) => (
                <BadgeIcon key={b.id} iconKey={b.icon} size={14} color={b.color} />
              ))}
              <MaterialCommunityIcons name={getCurrentLevel(item.otherXP).icon as any} size={14} color={getCurrentLevel(item.otherXP).color} />
            </View>
            <Text style={s.preview} numberOfLines={1}>
              {item.lastMessage ?? 'Sin mensajes aún'}
            </Text>
          </View>


              {item.unreadCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeTxt}>
                    {item.unreadCount > 9 ? '9+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* ── Action sheet — long press conversación ────────────────────────── */}
      <Modal
        visible={!!selectedConv} transparent animationType="slide"
        onRequestClose={() => setSelectedConv(null)}
      >
        <Pressable style={s.overlay} onPress={() => setSelectedConv(null)}>
          <View style={[s.actionSheet, { paddingBottom: insets.bottom + 8 }]}>
            {/* Info del chat seleccionado */}
            <View style={s.actionHeader}>
              {selectedConv?.otherAvatar ? (
                <Image source={{ uri: selectedConv.otherAvatar }} style={s.actionAvatar} />
              ) : (
                <View style={[s.actionAvatar, s.avatarPlaceholder]}>
                  <Ionicons name="person-outline" size={16} color="#9CA3AF" />
                </View>
              )}
              <Text style={s.actionName}>{selectedConv?.otherName}</Text>
            </View>
            <View style={s.actionDivider} />

            <TouchableOpacity style={s.actionRow} onPress={handleDeleteConversation}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[s.actionTxt, { color: '#ef4444' }]}>Borrar conversación</Text>
            </TouchableOpacity>
            <View style={s.actionDivider} />

            <TouchableOpacity style={s.actionRow} onPress={() => setSelectedConv(null)}>
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
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0f0f0fff', borderRadius: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8,
    paddingHorizontal: 12, height: 40,
  },
  searchInput: { flex: 1, color: '#F3F4F6', fontSize: 14 },
  separator: { height: 1, backgroundColor: '#181818ff', marginLeft: 76 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    backgroundColor: '#0F1016', borderWidth: 1, borderColor: '#2C2C33',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: '#F3F4F6', fontWeight: '700', fontSize: 15 },
  preview: { color: '#9CA3AF', fontSize: 13, marginTop: 2 },
  badge: {
    backgroundColor: '#ef4444', borderRadius: 10,
    minWidth: 20, height: 20, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 100, gap: 12 },
  emptyTxt: { color: '#9CA3AF', fontSize: 15 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  actionSheet: {
    backgroundColor: '#010102ff', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, borderTopWidth: 1,
    borderColor: '#181818ff', paddingTop: 8,
  },
  actionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 20, paddingVertical: 14,
  },
  actionAvatar: { width: 38, height: 38, borderRadius: 19 },
  actionName: { color: '#F3F4F6', fontWeight: '700', fontSize: 15 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, paddingHorizontal: 20, paddingVertical: 16,
  },
  actionTxt: { color: '#F3F4F6', fontSize: 16, fontWeight: '500' },
  actionDivider: { height: 1, backgroundColor: '#181818ff', marginHorizontal: 20 },
});

const sk = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1a1a1aff' },
  nameLine: { height: 14, width: '50%', borderRadius: 6, backgroundColor: '#1a1a1aff' },
  previewLine: { height: 12, width: '75%', borderRadius: 6, backgroundColor: '#1a1a1aff' },
  badge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1a1a1aff' },
});

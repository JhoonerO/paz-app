// app/(tabs)/notifications.tsx
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type NotificationItem = {
  id: string;
  type: 'like' | 'comment';
  actorName: string;
  actorAvatar: string | null;
  storyId: string;
  storyTitle: string;
  storyAuthor: string;
  storyCover: string | null;
  createdAt: number;
  read: boolean;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const HEADER_BAR = 56;

  const loadNotifications = async (userId: string) => {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        story_id,
        created_at,
        read,
        profiles!notifications_actor_id_fkey ( display_name, avatar_url ),
        stories!notifications_story_id_fkey (
          title,
          cover_url,
          author_name
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return;
    }

    const mapped = data.map((n: any) => {
      const actorName = n.profiles?.display_name?.trim() || 'Alguien';
      const actorAvatar = n.profiles?.avatar_url ?? null;
      const storyTitle = n.stories?.title?.trim() || 'Historia sin título';
      const storyAuthor = n.stories?.author_name?.trim() || 'Autor';
      const storyCover =
        (n.stories?.cover_url && n.stories.cover_url.trim().length > 0)
          ? n.stories.cover_url.trim()
          : null;

      return {
        id: n.id,
        type: n.type as 'like' | 'comment',
        actorName,
        actorAvatar,
        storyId: n.story_id,
        storyTitle,
        storyAuthor,
        storyCover,
        createdAt: new Date(n.created_at).getTime(),
        read: n.read,
      };
    });

    setNotifications(mapped);
  };

  useEffect(() => {
    const loadAndListen = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;
      if (!uid) return;

      await loadNotifications(uid);

      const channel = supabase
        .channel('notifications-listener')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            loadNotifications(uid);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    loadAndListen();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000ff' }} edges={['top', 'bottom']}>
      <View
        style={[s.header, { paddingTop: insets.top, height: insets.top + HEADER_BAR }]}
      >
        <Text
      style={{
        fontFamily: 'Risque_400Regular',
        fontSize: 22,
        color: '#F3F4F6',
        letterSpacing: 1,
      }}
    >
      Notificaciones
    </Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => <NotificationRow item={item} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text
      style={{
        fontFamily: 'Risque_400Regular',
        fontSize: 22,
        color: '#F3F4F6',
        letterSpacing: 1,
        textAlign: 'center',
      }}
    >
      No tienes notificaciones.
    </Text>
        }
      />
    </SafeAreaView>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const message =
    item.type === 'like'
      ? `${item.actorName} le ha gustado tu historia`
      : `${item.actorName} comentó tu historia`;

  const ago = timeAgo(item.createdAt);

  return (
    <Link
      href={{
        pathname: '/story/[id]',
        params: {
          id: item.storyId,
          title: item.storyTitle,
          author: item.storyAuthor,
          body: '',
          cover: item.storyCover ?? '',
          likes: '0',
          comments: '0',
          source: 'notifications',
        },
      }}
      asChild
    >
      <TouchableOpacity activeOpacity={0.85} style={s.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
          <View style={s.avatarWrap}>
            {item.actorAvatar ? (
              <Image source={{ uri: item.actorAvatar }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, { backgroundColor: '#0F1016' }]} />
            )}
            {!item.read && <View style={s.unreadDot} />}
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={item.type === 'like' ? 'heart' : 'chatbubble-ellipses'}
                size={14}
                color={item.type === 'like' ? '#ef4444' : '#F3F4F6'}
              />
              <Text style={s.message} numberOfLines={2}>
                {message}
              </Text>
            </View>

            <Text style={s.storyTitle} numberOfLines={1}>
              “{item.storyTitle}”
            </Text>

            <Text style={s.time}>{ago}</Text>
          </View>
        </View>

        {item.storyCover && (
          <Image
            source={{ uri: item.storyCover }}
            style={s.thumb}
            resizeMode="cover"
            onError={() => {}}
          />
        )}
      </TouchableOpacity>
    </Link>
  );
}

function timeAgo(ts: number) {
  const diff = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `hace ${diff}s`;
  const m = Math.floor(diff / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

const s = StyleSheet.create({
  header: {
    backgroundColor: '#000000ff',
    borderBottomWidth: 1,

    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#F3F4F6',
    fontSize: 18,
    fontWeight: '700',
  },

  //bg: '#000000ff',
  //card: '#010102ff',
  //cardBorder: '#181818ff',
  //textPrimary: '#F3F4F6',
  //textSecondary: '#A1A1AA',
  //line: '#000000ff',
  //avatarBg: '#0F1016',
  //avatarBorder: '#2C2C33',
  //like: '#ef4444',

  row: {
    backgroundColor: '#010102ff',
    borderWidth: 1,
    borderColor: '#181818ff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: { width: 42, height: 42 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, borderColor: '#1F1F27',
  },
  unreadDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#3B82F6',
    borderWidth: 2, borderColor: '#121219',
  },
  message: { color: '#E5E7EB', fontWeight: '600', flexShrink: 1 },
  storyTitle: { color: '#C9C9D1', marginTop: 2 },
  time: { color: '#9CA3AF', marginTop: 2, fontSize: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
});
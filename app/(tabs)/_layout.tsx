// app/(tabs)/_layout.tsx
import { Tabs, Link, useNavigation, useRouter, usePathname } from 'expo-router';
import {
  Pressable,
  View,
  Text,
  useWindowDimensions,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Risque_400Regular } from '@expo-google-fonts/risque';

// ✅ usePathname aislado aquí — cuando cambia el path, solo este componente
//    re-renderiza, NO TabsLayout ni Tabs → sin rebote en la animación
function FloatingActionButton({
  tabBarHeight,
  fabSize,
  fabRight,
}: {
  tabBarHeight: number;
  fabSize: number;
  fabRight: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const fabLock = useRef(false);

  const hideFab =
    pathname === '/messages' ||
    pathname.startsWith('/messages/') ||
    pathname === '/create' ||
    pathname.startsWith('/create/');

  return (
    <>
      <View
        pointerEvents={hideFab ? 'none' : 'auto'}
        style={[
          s.fab,
          {
            width: fabSize,
            height: fabSize,
            borderRadius: fabSize / 2,
            bottom: tabBarHeight + 14,
            right: fabRight,
            opacity: hideFab ? 0 : 1,
          },
        ]}
      >
        <TouchableOpacity
          style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => {
            if (fabLock.current || hideFab) return;
            fabLock.current = true;
            router.push('/(tabs)/create');
            setTimeout(() => { fabLock.current = false; }, 600);
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color="#F3F4F6" />
        </TouchableOpacity>
      </View>
    </>
  );
}

// ✅ Fuera del layout — no se recrean en cada render
function HeaderTitle({ width }: { width: number }) {
  return (
    <Text
      adjustsFontSizeToFit
      numberOfLines={1}
      style={{
        fontFamily: 'Risque_400Regular',
        fontSize: width * 0.055,
        color: '#F3F4F6',
        letterSpacing: 0.2,
        minWidth: 80,
        textAlign: 'center',
      }}
    >
      U-PAZ
    </Text>
  );
}

function HeaderRight({ unreadCount, muted }: { unreadCount: number; muted: boolean }) {
  return (
    <Link href="/notifications" asChild>
      <Pressable hitSlop={10} style={{ paddingHorizontal: 12 }}>
        <View style={{ position: 'relative' }}>
          <Ionicons name="notifications-sharp" size={24} color="white" />
          {unreadCount > 0 && !muted && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

export default function TabsLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notifMuted, setNotifMuted] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation();

  const [fontsLoaded] = useFonts({ Risque_400Regular });

  const TAB_BAR_HEIGHT = 50 + insets.bottom;
  const FAB_SIZE = 46;
  const fabRight = width / 6 - FAB_SIZE / 2;

  // ✅ Memoizados para que Tabs no los vea como props nuevos en cada render
  const headerTitleFn = useCallback(() => <HeaderTitle width={width} />, [width]);
  const headerRightFn = useCallback(
    () => <HeaderRight unreadCount={unreadCount} muted={notifMuted} />,
    [unreadCount, notifMuted]
  );

  const loadUnread = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ count, error }, { data: prof }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false),
      supabase
        .from('profiles')
        .select('notifications_muted')
        .eq('id', user.id)
        .single<{ notifications_muted: boolean }>(),
    ]);
    if (!error && typeof count === 'number') setUnreadCount(count);
    setNotifMuted(Boolean(prof?.notifications_muted));
  };

  const loadUnreadMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: convs } = await supabase
      .from('conversations')
      .select('id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
    if (!convs || convs.length === 0) return;
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('conversation_id', convs.map((c: any) => c.id))
      .eq('read', false)
      .neq('sender_id', user.id);
    setUnreadMessages(count ?? 0);
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let msgChannel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await loadUnread();
      await loadUnreadMessages();

      channel = supabase
        .channel('notifications-counter')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => loadUnread()
        ).subscribe();

      msgChannel = supabase
        .channel('messages-counter')
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'messages' },
          () => loadUnreadMessages()
        ).subscribe();
    };

    init();
    return () => {
      if (channel) supabase.removeChannel(channel);
      if (msgChannel) supabase.removeChannel(msgChannel);
    };
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      loadUnread();
      loadUnreadMessages();
    });
    return unsub;
  }, [navigation]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: '#000000ff' },
          headerTintColor: '#F3F4F6',
          headerTitle: headerTitleFn,
          headerTitleAlign: 'center',
          headerRight: headerRightFn,
          animation: 'shift',
          transitionSpec: {
            animation: 'timing',
            config: { duration: 260 },
          },
          tabBarStyle: {
            backgroundColor: '#000000ff',
            borderTopColor: '#181818ff',
            height: TAB_BAR_HEIGHT,
            paddingBottom: insets.bottom,
            paddingTop: 8,
          },
          tabBarActiveTintColor: '#F3F4F6',
          tabBarInactiveTintColor: '#A1A1AA',
          tabBarShowLabel: false,
        }}
      >
        {/* Feed */}
        <Tabs.Screen
          name="index"
          options={{
            title: 'Inicio',
            headerLeft: () => (
              <Link href="/search" asChild>
                <Pressable hitSlop={10} style={{ paddingHorizontal: 16 }}>
                  <Ionicons name="search" size={24} color="#F3F4F6" />
                </Pressable>
              </Link>
            ),
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
          }}
        />

        {/* Mensajes */}
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Mensajes',
            headerLeft: () => (
              <Link href="/search" asChild>
                <Pressable hitSlop={10} style={{ paddingHorizontal: 16 }}>
                  <Ionicons name="search" size={24} color="#F3F4F6" />
                </Pressable>
              </Link>
            ),
            tabBarIcon: ({ color, size }) => (
              <View>
                <Ionicons name="chatbox-outline" size={size} color={color} />
                {unreadMessages > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeTxt}>
                      {unreadMessages > 9 ? '9+' : unreadMessages}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />

        {/* Perfil */}
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Perfil',
            headerLeft: () => <View style={{ width: 44, marginLeft: 12 }} />,
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
          }}
        />

        {/* Crear — oculto de la barra, accesible via FAB */}
        <Tabs.Screen
          name="create"
          options={{
            href: null,
            headerLeft: () => (
              <Link href="/search" asChild>
                <Pressable hitSlop={10} style={{ paddingHorizontal: 16 }}>
                  <Ionicons name="search" size={24} color="#F3F4F6" />
                </Pressable>
              </Link>
            ),
          }}
        />
      </Tabs>

      {/* ✅ FAB como componente aislado — su re-render no afecta a Tabs */}
      <FloatingActionButton
        tabBarHeight={TAB_BAR_HEIGHT}
        fabSize={FAB_SIZE}
        fabRight={fabRight}
      />
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  fab: {
    position: 'absolute',
    backgroundColor: '#1f1f1fff',
    borderWidth: 1,
    borderColor: '#2C2C33',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
});

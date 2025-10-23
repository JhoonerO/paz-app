// app/(tabs)/_layout.tsx
import { Tabs, Link } from 'expo-router';
import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useFonts, Risque_400Regular } from '@expo-google-fonts/risque';
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';
import * as SplashScreen from 'expo-splash-screen';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // 👈 AGREGAR ESTO

SplashScreen.preventAutoHideAsync();

export default function TabsLayout() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [fontsLoaded] = useFonts({ Risque_400Regular });
  const insets = useSafeAreaInsets(); // 👈 AGREGAR ESTO

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  const loadUnread = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (!error && typeof count === 'number') setUnreadCount(count);
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await loadUnread();

      channel = supabase
        .channel('notifications-counter')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => loadUnread()
        )
        .subscribe();
    };

    init();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  if (!fontsLoaded) return null;

  const HeaderTitle = () => (
    <Text
      style={{
        fontFamily: 'Risque_400Regular',
        fontSize: 22,
        color: '#F3F4F6',
        letterSpacing: 1,
      }}
    >
      U-PAZ
    </Text>
  );

  const HeaderRight = () => (
    <Link href="/notifications" asChild>
      <Pressable hitSlop={10} style={{ paddingHorizontal: 12 }}>
        <View style={{ position: 'relative' }}>
          <Ionicons name="notifications-sharp" size={24} color="white" />
          {unreadCount > 0 && (
            <View
              style={{
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
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Link>
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#000000ff' },
        headerTintColor: '#F3F4F6',
        headerTitle: () => <HeaderTitle />,
        headerTitleAlign: 'center',
        tabBarStyle: {
          backgroundColor: '#000000ff',
          borderTopColor: '#181818ff',
          height: 50 + insets.bottom, // 👈 CAMBIAR ESTO
          paddingBottom: insets.bottom, // 👈 AGREGAR ESTO
          paddingTop: 8, // 👈 AGREGA ESTA LÍNEA
        },
        tabBarActiveTintColor: '#F3F4F6',
        tabBarInactiveTintColor: '#A1A1AA',
        tabBarShowLabel: false,
        headerRight: () => <HeaderRight />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          headerLeft: () => <View style={{ width: 44, marginLeft: 12 }} />,
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Crear',
          headerLeft: () => (
            <Link href="/" asChild>
              <Pressable hitSlop={10} style={{ paddingHorizontal: 16 }}>
                <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
              </Pressable>
            </Link>
          ),
          tabBarIcon: ({ color, size }) => (
            <AntDesign name="plus-square" size={size} color={color} />
          ),
        }}
      />
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
    </Tabs>
  );
}

import { Tabs, Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function TabsLayout() {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const checkUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      setHasUnread((count || 0) > 0);
    };

    checkUnread();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#121219' },
        headerTintColor: '#F3F4F6',
        headerTitle: 'PAZ',
        tabBarStyle: {
          backgroundColor: '#121219',
          borderTopColor: '#121219',
          height: 58,
        },
        tabBarActiveTintColor: '#F3F4F6',
        tabBarInactiveTintColor: '#A1A1AA',
        tabBarShowLabel: false,
        headerRight: () => (
          <Link href="/notifications" asChild>
            <Pressable hitSlop={10} style={{ paddingHorizontal: 12 }}>
              <View style={{ position: 'relative' }}>
                <Ionicons name="notifications-outline" size={22} color="#F3F4F6" />
                {hasUnread && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: '#ef4444',
                    }}
                  />
                )}
              </View>
            </Pressable>
          </Link>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Crear',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
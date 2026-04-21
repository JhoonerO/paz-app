import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function NatalIABanner() {
  const router = useRouter();
  const [activaCount, setActivaCount] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('dinamicas')
      .select('id, titulo')
      .eq('activa', true)
      .gte('fecha_fin', new Date().toISOString())
      .order('fecha_inicio', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setActivaCount(data.length);
          setPreview(data[0].titulo);
        }
      });
  }, []);

  return (
    <TouchableOpacity
      style={s.banner}
      activeOpacity={0.8}
      onPress={() => router.push('/natal-ia')}
    >
      <View style={s.left}>
        <MaterialCommunityIcons name="bat" size={22} color="#C084FC" />
        <View style={s.textCol}>
          <View style={s.topRow}>
            <Text style={s.name}>Natal-IA</Text>
            {activaCount > 0 && (
              <View style={s.pill}>
                <Text style={s.pillTxt}>{activaCount} {activaCount === 1 ? 'dinámica' : 'dinámicas'}</Text>
              </View>
            )}
          </View>
          <Text style={s.preview} numberOfLines={1}>
            {preview ?? 'Ver dinámicas del día...'}
          </Text>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#6B7280" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F0A1A',
    borderWidth: 1,
    borderColor: '#3B1F5E',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: '#C084FC',
    fontWeight: '700',
    fontSize: 14,
  },
  pill: {
    backgroundColor: '#2D1B4E',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillTxt: {
    color: '#A855F7',
    fontSize: 11,
    fontWeight: '600',
  },
  preview: {
    color: '#9CA3AF',
    fontSize: 12,
  },
});

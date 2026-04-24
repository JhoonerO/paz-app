import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

export default function NatalIABanner() {
  const router = useRouter();
  const [activaCount, setActivaCount] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const pulse = useSharedValue(0.55);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800 }),
        withTiming(0.55, { duration: 1800 }),
      ),
      -1,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

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
      style={s.card}
      activeOpacity={0.82}
      onPress={() => router.push('/natal-ia')}
    >
      {/* Glow de fondo animado */}
      <Animated.View style={[s.glow, glowStyle]} pointerEvents="none" />

      {/* Fila superior: ícono + pill */}
      <View style={s.topRow}>
        <View style={s.iconCircle}>
          <MaterialCommunityIcons name="bat" size={22} color="#C084FC" />
        </View>
        <View style={s.pill}>
          <MaterialCommunityIcons name="lightning-bolt" size={11} color="#A855F7" />
          <Text style={s.pillTxt}>
            {activaCount > 0
              ? `${activaCount} ${activaCount === 1 ? 'reto activo' : 'retos activos'}`
              : 'Natal-IA'}
          </Text>
        </View>
      </View>

      {/* Titular principal */}
      <Text style={s.headline}>
        ¿Qué retos tiene{'\n'}
        <Text style={s.headlineAccent}>Natal-IA</Text> para ti hoy?
      </Text>

      {/* Preview del primer reto */}
      {preview ? (
        <View style={s.previewRow}>
          <MaterialCommunityIcons name="chevron-right" size={13} color="#7C3AED" />
          <Text style={s.previewTxt} numberOfLines={1}>{preview}</Text>
        </View>
      ) : (
        <View style={s.previewRow}>
          <MaterialCommunityIcons name="chevron-right" size={13} color="#7C3AED" />
          <Text style={s.previewTxt}>Ver las dinámicas del día...</Text>
        </View>
      )}

      {/* CTA */}
      <View style={s.cta}>
        <Text style={s.ctaTxt}>Ver todos los retos</Text>
        <MaterialCommunityIcons name="arrow-right" size={15} color="#C084FC" />
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#0A0614',
    borderWidth: 1.5,
    borderColor: '#5B21B6',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    position: 'absolute',
    top: -30,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#6D28D9',
    opacity: 0.55,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E0A3C',
    borderWidth: 1,
    borderColor: '#6D28D9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A0A30',
    borderWidth: 1,
    borderColor: '#4C1D95',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillTxt: {
    color: '#A855F7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headline: {
    color: '#E9D5FF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  headlineAccent: {
    color: '#C084FC',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 14,
  },
  previewTxt: {
    color: '#6D28D9',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-end',
    backgroundColor: '#1E0A3C',
    borderWidth: 1,
    borderColor: '#7C3AED',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaTxt: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '700',
  },
});

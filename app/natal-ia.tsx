import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useFonts, Risque_400Regular } from '@expo-google-fonts/risque';
import { supabase } from '../lib/supabase';
import { formatCoins } from '../lib/gamification';

type Dinamica = {
  id: string;
  titulo: string;
  descripcion: string;
  instrucciones: string | null;
  tipo: string;
  xp_reward: number;
  coins_reward: number;
  badge_id: string | null;
  fecha_fin: string | null;
  condicion: any;
  activa: boolean;
};

type EstadoDesafio = 'libre' | 'aceptado' | 'completado';

function timeLeft(fechaFin: string | null): string {
  if (!fechaFin) return '';
  const diff = new Date(fechaFin).getTime() - Date.now();
  if (diff <= 0) return 'Expirado';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d restantes`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const TIPO_LABELS: Record<string, string> = {
  subir_historia: 'HISTORIA',
  comentar: 'COMENTARIOS',
  recibir_like: 'LIKES',
  estar_activo: 'LECTURA',
  diaria: 'DIARIA',
};

const TIPO_ICONS: Record<string, string> = {
  subir_historia: 'feather',
  comentar: 'comment-text-outline',
  recibir_like: 'heart-outline',
  estar_activo: 'book-open-page-variant-outline',
  diaria: 'star-four-points',
};

function RewardChips({ xp, coins, hasBadge }: { xp: number; coins: number; hasBadge: boolean }) {
  return (
    <View style={s.chips}>
      {xp > 0 && (
        <View style={[s.chip, s.chipXP]}>
          <MaterialCommunityIcons name="star-four-points" size={11} color="#818CF8" />
          <Text style={[s.chipTxt, { color: '#818CF8' }]}>+{xp} XP</Text>
        </View>
      )}
      {coins > 0 && (
        <View style={[s.chip, s.chipCoins]}>
          <MaterialCommunityIcons name="cash" size={11} color="#C084FC" />
          <Text style={[s.chipTxt, { color: '#C084FC' }]}>+{formatCoins(coins)}</Text>
        </View>
      )}
      {hasBadge && (
        <View style={[s.chip, s.chipBadge]}>
          <MaterialCommunityIcons name="medal" size={11} color="#F59E0B" />
          <Text style={[s.chipTxt, { color: '#F59E0B' }]}>Medalla</Text>
        </View>
      )}
    </View>
  );
}

function DinamicaCard({
  item,
  estado,
  onAceptar,
  aceptando,
}: {
  item: Dinamica;
  estado: EstadoDesafio;
  onAceptar: (id: string) => void;
  aceptando: boolean;
}) {
  const remaining = timeLeft(item.fecha_fin);
  const condTipo = item.condicion?.tipo ?? 'diaria';
  const iconName = TIPO_ICONS[condTipo] ?? 'star-four-points';
  const tipoLabel = TIPO_LABELS[condTipo] ?? item.tipo?.toUpperCase() ?? 'DIARIA';

  return (
    <View style={[
      s.card,
      estado === 'completado' && s.cardDone,
      estado === 'aceptado' && s.cardActive,
    ]}>
      {/* Línea de color superior */}
      <View style={[
        s.cardAccent,
        estado === 'completado' && { backgroundColor: '#34D399' },
        estado === 'aceptado' && { backgroundColor: '#7C3AED' },
        estado === 'libre' && { backgroundColor: '#2D1B4E' },
      ]} />

      {/* Header */}
      <View style={s.cardHeader}>
        <View style={s.cardTipoRow}>
          <MaterialCommunityIcons name={iconName as any} size={12} color="#6B7280" />
          <Text style={s.cardTipo}>{tipoLabel}</Text>
        </View>
        <View style={s.cardBadgeRow}>
          {estado === 'completado' && (
            <View style={s.doneBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#34D399" />
              <Text style={s.doneTxt}>Completado</Text>
            </View>
          )}
          {estado === 'aceptado' && (
            <View style={s.inProgressBadge}>
              <MaterialCommunityIcons name="clock-fast" size={13} color="#A78BFA" />
              <Text style={s.inProgressTxt}>En progreso</Text>
            </View>
          )}
          {remaining ? (
            <Text style={s.remaining}>{remaining}</Text>
          ) : null}
        </View>
      </View>

      {/* Título */}
      <Text style={s.cardTitle}>{item.titulo}</Text>

      {/* Descripción */}
      <Text style={s.cardDesc}>{item.descripcion}</Text>

      {/* Instrucciones — solo si está aceptado */}
      {estado === 'aceptado' && item.instrucciones && (
        <View style={s.instruccionesBox}>
          <View style={s.instruccionesHeader}>
            <MaterialCommunityIcons name="lightning-bolt" size={13} color="#A78BFA" />
            <Text style={s.instruccionesLabel}>Cómo completarlo</Text>
          </View>
          <Text style={s.instruccionesTxt}>{item.instrucciones}</Text>
        </View>
      )}

      {/* Recompensas */}
      <RewardChips xp={item.xp_reward} coins={item.coins_reward} hasBadge={!!item.badge_id} />

      {/* Acción */}
      {estado === 'libre' && (
        <TouchableOpacity
          style={s.acceptBtn}
          activeOpacity={0.8}
          onPress={() => onAceptar(item.id)}
          disabled={aceptando}
        >
          {aceptando ? (
            <ActivityIndicator size="small" color="#E9D5FF" />
          ) : (
            <>
              <MaterialCommunityIcons name="sword-cross" size={15} color="#E9D5FF" />
              <Text style={s.acceptBtnTxt}>Aceptar desafío</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {estado === 'completado' && (
        <View style={s.completedRow}>
          <MaterialCommunityIcons name="party-popper" size={13} color="#34D399" />
          <Text style={s.completedHint}>Natal-IA ya registró tu recompensa</Text>
        </View>
      )}
    </View>
  );
}

function NatalHeader() {
  const [fontsLoaded] = useFonts({ Risque_400Regular });
  const glow = useSharedValue(0.4);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <View style={s.natalHeader}>
      {/* Icono animado */}
      <View style={s.natalIconWrap}>
        <Animated.View style={[s.natalGlow, glowStyle]} />
        <MaterialCommunityIcons name="bat" size={32} color="#C084FC" />
      </View>

      <Text style={[s.natalName, fontsLoaded && { fontFamily: 'Risque_400Regular' }]}>
        Natal-IA
      </Text>
      <Text style={s.natalQuote}>
        "Soy el eco que quedó entre las páginas no contadas. No tengo forma... pero lo sé todo."
      </Text>
    </View>
  );
}

export default function NatalIAScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [dinamicas, setDinamicas] = useState<Dinamica[]>([]);
  const [estados, setEstados] = useState<Map<string, EstadoDesafio>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [aceptando, setAceptando] = useState<string | null>(null);

  const cargar = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    setUserId(uid);

    const { data: dins } = await supabase
      .from('dinamicas')
      .select('*')
      .eq('activa', true)
      .order('fecha_inicio', { ascending: false });

    setDinamicas(dins ?? []);

    if (uid && dins && dins.length > 0) {
      const ids = dins.map((d: Dinamica) => d.id);

      const fetchEstados = async () => {
        const { data: userDins } = await supabase
          .from('user_dinamicas')
          .select('dinamica_id, completada_at')
          .eq('user_id', uid)
          .in('dinamica_id', ids);
        const mapa = new Map<string, EstadoDesafio>();
        for (const ud of userDins ?? []) {
          mapa.set(ud.dinamica_id, ud.completada_at ? 'completado' : 'aceptado');
        }
        return mapa;
      };

      const mapa = await fetchEstados();
      setEstados(mapa);

      // Si hay retos aceptados pendientes, llamar a la función de verificación
      const hayPendientes = [...mapa.values()].some(e => e === 'aceptado');
      if (hayPendientes) {
        setVerificando(true);
        try {
          await supabase.functions.invoke('verificar-dinamicas');
          // Recargar estados después de verificar
          const mapaActualizado = await fetchEstados();
          setEstados(mapaActualizado);
        } catch {
          // Si falla la verificación, no bloqueamos al usuario
        } finally {
          setVerificando(false);
        }
      }
    }

    setLoading(false);
    if (isRefresh) setRefreshing(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const aceptarDesafio = async (dinamicaId: string) => {
    if (!userId) {
      Alert.alert('Espera', 'Debes iniciar sesión para aceptar desafíos.');
      return;
    }
    setAceptando(dinamicaId);
    const { error } = await supabase.from('user_dinamicas').insert({
      user_id: userId,
      dinamica_id: dinamicaId,
      aceptada_at: new Date().toISOString(),
      completada_at: null,
      recompensa_entregada: false,
    });

    if (!error) {
      setEstados(prev => new Map(prev).set(dinamicaId, 'aceptado'));
    }
    setAceptando(null);
  };

  const completadas = [...estados.values()].filter(e => e === 'completado').length;
  const total = dinamicas.length;

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      {/* Topbar */}
      <View style={[s.topbar, { paddingTop: insets.top > 0 ? 0 : 12 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>
        {total > 0 && (
          <View style={s.progressPill}>
            <MaterialCommunityIcons name="sword-cross" size={12} color="#A78BFA" />
            <Text style={s.progressTxt}>{completadas}/{total} completados</Text>
          </View>
        )}
        <View style={{ width: 24 }} />
      </View>

      {verificando && (
        <View style={s.verificandoBanner}>
          <ActivityIndicator size="small" color="#A78BFA" />
          <Text style={s.verificandoTxt}>Natal-IA está verificando tus retos...</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#C084FC" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={dinamicas}
          keyExtractor={(d) => d.id}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={() => cargar(true)}
          ListHeaderComponent={<NatalHeader />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <MaterialCommunityIcons name="bat" size={44} color="#1E1A2E" />
              <Text style={s.emptyTxt}>Natal-IA está preparando los desafíos de hoy...</Text>
              <Text style={s.emptyHint}>Vuelve más tarde, parcero.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <DinamicaCard
              item={item}
              estado={estados.get(item.id) ?? 'libre'}
              onAceptar={aceptarDesafio}
              aceptando={aceptando === item.id}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080810' },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  progressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#130D21',
    borderWidth: 1,
    borderColor: '#2D1B4E',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  progressTxt: { color: '#A78BFA', fontSize: 12, fontWeight: '700' },

  // ── Header Natal ───────────────────────────────────────
  natalHeader: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
    marginBottom: 8,
  },
  natalIconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  natalGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#7C3AED',
  },
  natalName: {
    fontSize: 28,
    color: '#E9D5FF',
    letterSpacing: 1,
    fontWeight: '700',
  },
  natalQuote: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: 300,
  },

  // ── Cards ──────────────────────────────────────────────
  card: {
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: '#1A1A2E',
    borderRadius: 16,
    overflow: 'hidden',
    gap: 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  cardAccent: {
    height: 3,
    marginBottom: 6,
    marginHorizontal: -16,
  },
  cardActive: { borderColor: '#4C1D95' },
  cardDone: { borderColor: '#1A3A2A', opacity: 0.75 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTipoRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardTipo: { color: '#4B5563', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  cardTitle: { color: '#F3F4F6', fontSize: 17, fontWeight: '700', lineHeight: 24 },
  cardDesc: { color: '#9CA3AF', fontSize: 13, lineHeight: 20 },

  remaining: { color: '#4B5563', fontSize: 11 },

  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneTxt: { color: '#34D399', fontSize: 11, fontWeight: '700' },
  inProgressBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inProgressTxt: { color: '#A78BFA', fontSize: 11, fontWeight: '700' },

  instruccionesBox: {
    backgroundColor: '#0A0820',
    borderWidth: 1,
    borderColor: '#2D1B4E',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  instruccionesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  instruccionesLabel: { color: '#A78BFA', fontSize: 12, fontWeight: '700' },
  instruccionesTxt: { color: '#C4B5FD', fontSize: 13, lineHeight: 20 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  chipXP: { backgroundColor: '#0D0B1A', borderColor: '#2D2860' },
  chipCoins: { backgroundColor: '#110A1A', borderColor: '#3B1F5E' },
  chipBadge: { backgroundColor: '#1A1200', borderColor: '#4B3800' },
  chipTxt: { fontSize: 11, fontWeight: '700' },

  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E0D3A',
    borderWidth: 1,
    borderColor: '#6D28D9',
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 2,
  },
  acceptBtnTxt: { color: '#E9D5FF', fontWeight: '700', fontSize: 14 },

  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  completedHint: { color: '#34D399', fontSize: 12 },

  verificandoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0D0820',
    borderBottomWidth: 1,
    borderColor: '#2D1B4E',
    paddingVertical: 8,
  },
  verificandoTxt: { color: '#A78BFA', fontSize: 12 },

  // ── Empty ──────────────────────────────────────────────
  empty: { alignItems: 'center', marginTop: 40, gap: 12 },
  emptyTxt: { color: '#4B5563', textAlign: 'center', fontSize: 15, fontWeight: '600', maxWidth: 260 },
  emptyHint: { color: '#374151', fontSize: 13 },
});

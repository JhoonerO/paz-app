import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { formatCoins } from '../lib/gamification';

type Dinamica = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  xp_reward: number;
  coins_reward: number;
  badge_id: string | null;
  fecha_fin: string | null;
  activa: boolean;
};

type UserDinamica = {
  dinamica_id: string;
  completada_at: string;
};

function timeLeft(fechaFin: string | null): string {
  if (!fechaFin) return '';
  const diff = new Date(fechaFin).getTime() - Date.now();
  if (diff <= 0) return 'Expirada';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}d restantes`;
  if (h > 0) return `${h}h ${m}m restantes`;
  return `${m}m restantes`;
}

function RewardChips({ xp, coins, hasBadge }: { xp: number; coins: number; hasBadge: boolean }) {
  return (
    <View style={s.chips}>
      {xp > 0 && (
        <View style={s.chip}>
          <MaterialCommunityIcons name="star-four-points" size={12} color="#818CF8" />
          <Text style={[s.chipTxt, { color: '#818CF8' }]}>+{xp} XP</Text>
        </View>
      )}
      {coins > 0 && (
        <View style={s.chip}>
          <MaterialCommunityIcons name="cash" size={12} color="#C084FC" />
          <Text style={[s.chipTxt, { color: '#C084FC' }]}>+{formatCoins(coins)}</Text>
        </View>
      )}
      {hasBadge && (
        <View style={s.chip}>
          <MaterialCommunityIcons name="medal" size={12} color="#F59E0B" />
          <Text style={[s.chipTxt, { color: '#F59E0B' }]}>Medalla especial</Text>
        </View>
      )}
    </View>
  );
}

function DinamicaCard({ item, completed }: { item: Dinamica; completed: boolean }) {
  const remaining = timeLeft(item.fecha_fin);

  return (
    <View style={[s.card, completed && s.cardDone]}>
      <View style={s.cardHeader}>
        <Text style={s.cardTipo}>{item.tipo?.toUpperCase() ?? 'DIARIA'}</Text>
        {completed && (
          <View style={s.doneBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#34D399" />
            <Text style={s.doneTxt}>Completada</Text>
          </View>
        )}
        {!completed && remaining ? (
          <Text style={s.remaining}>{remaining}</Text>
        ) : null}
      </View>

      <Text style={s.cardTitle}>{item.titulo}</Text>
      <Text style={s.cardDesc}>{item.descripcion}</Text>

      <RewardChips xp={item.xp_reward} coins={item.coins_reward} hasBadge={!!item.badge_id} />
    </View>
  );
}

export default function NatalIAScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [dinamicas, setDinamicas] = useState<Dinamica[]>([]);
  const [completadas, setCompletadas] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;

      const { data: dins } = await supabase
        .from('dinamicas')
        .select('*')
        .eq('activa', true)
        .order('fecha_inicio', { ascending: false });

      setDinamicas(dins ?? []);

      if (uid && dins && dins.length > 0) {
        const ids = dins.map((d: Dinamica) => d.id);
        const { data: userDins } = await supabase
          .from('user_dinamicas')
          .select('dinamica_id')
          .eq('user_id', uid)
          .in('dinamica_id', ids);

        setCompletadas(new Set((userDins ?? []).map((ud: UserDinamica) => ud.dinamica_id)));
      }

      setLoading(false);
    })();
  }, []);

  return (
    <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
      <View style={[s.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <MaterialCommunityIcons name="bat" size={20} color="#C084FC" />
          <Text style={s.headerTitle}>Natal-IA</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={s.natalInfo}>
        <Text style={s.natalQuote}>
          "Hola, soy Natal-IA. Cada día creo desafíos para la comunidad. Completa las dinámicas y gana recompensas."
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#C084FC" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={dinamicas}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <MaterialCommunityIcons name="bat" size={40} color="#3B1F5E" />
              <Text style={s.emptyTxt}>Natal-IA está preparando las dinámicas de hoy...</Text>
            </View>
          }
          renderItem={({ item }) => (
            <DinamicaCard item={item} completed={completadas.has(item.id)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080810' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#C084FC', fontSize: 18, fontWeight: '700' },
  natalInfo: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    backgroundColor: '#0F0A1A',
    borderWidth: 1,
    borderColor: '#3B1F5E',
    borderRadius: 12,
    padding: 14,
  },
  natalQuote: { color: '#9CA3AF', fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  card: {
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: '#1E1E3A',
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  cardDone: { borderColor: '#1A3A2A', opacity: 0.75 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTipo: { color: '#6B7280', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  cardTitle: { color: '#F3F4F6', fontSize: 16, fontWeight: '700' },
  cardDesc: { color: '#9CA3AF', fontSize: 13, lineHeight: 20 },
  remaining: { color: '#6B7280', fontSize: 11 },
  doneBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  doneTxt: { color: '#34D399', fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#13131F',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipTxt: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 60, gap: 16 },
  emptyTxt: { color: '#6B7280', textAlign: 'center', fontSize: 14, maxWidth: 240 },
});

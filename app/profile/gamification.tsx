// app/profile/gamification.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import NatalIABanner from '../../components/NatalIABanner';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Risque_400Regular } from '@expo-google-fonts/risque';
import { supabase } from '../../lib/supabase';
import {
  LEVELS,
  getCurrentLevel,
  getNextLevel,
  getLevelProgress,
  XP_PER_LIKE,
  XP_PER_2_COMMENTS,
  XP_PER_STORY,
  XP_PER_READ,
  XP_STREAK_BONUS,
} from '../../lib/gamification';
import { getStaticBadges, type StaticBadge } from '../../lib/badges';
import { BadgeIcon } from './settings';

const BADGES_VISIBLE_LIMIT = 5;
const COLS = 5;

type GamData = {
  xp: number;
  streak_days: number;
  longest_streak: number;
};

type DailyData = {
  likes_done: number;
  comments_done: number;
  stories_done: number;
  reads_done: number;
  streak_bonus_claimed: boolean;
};

type ProfileBadge = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string | null;
};

function AnimatedTrophy({ color, icon }: { color: string; icon: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.4)).current;
  const ringScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.18, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={t.container}>
      <Animated.View style={[t.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
      <View style={t.circle}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <MaterialCommunityIcons name={icon as any} size={72} color={color} />
        </Animated.View>
      </View>
    </View>
  );
}

export default function GamificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Risque_400Regular });
  const { userId: paramUserId } = useLocalSearchParams<{ userId?: string }>();

  const [loading, setLoading] = useState(true);
  const [gam, setGam] = useState<GamData>({ xp: 0, streak_days: 0, longest_streak: 0 });
  const [daily, setDaily] = useState<DailyData>({
    likes_done: 0, comments_done: 0, stories_done: 0, reads_done: 0, streak_bonus_claimed: false,
  });

  // Badges
  const [staticBadges, setStaticBadges] = useState<StaticBadge[]>([]);
  const [dbBadges, setDbBadges] = useState<ProfileBadge[]>([]);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<{ name: string; description: string; color: string; icon: string } | null>(null);
  const [showBadgeDetail, setShowBadgeDetail] = useState(false);

  // isOwnProfile: si no hay paramUserId, es el perfil propio
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [isOwn, setIsOwn] = useState(true);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const currentUid = auth.user?.id;

    const targetUid = paramUserId ?? currentUid ?? null;
    if (!targetUid) { setLoading(false); return; }

    setResolvedUserId(targetUid);
    setIsOwn(!paramUserId || paramUserId === currentUid);

    const now = new Date();
    const colombiaOffset = -5 * 60;
    const localColombia = new Date(now.getTime() + (colombiaOffset - now.getTimezoneOffset()) * 60000);
    const today = localColombia.toISOString().split('T')[0];

    // Cargar XP + racha
    const { data: g } = await supabase
      .from('user_gamification')
      .select('xp, streak_days, longest_streak')
      .eq('user_id', targetUid)
      .maybeSingle();
    if (g) setGam({ xp: g.xp ?? 0, streak_days: g.streak_days ?? 0, longest_streak: g.longest_streak ?? 0 });

    // Misiones de hoy solo para el propio usuario
    if (!paramUserId || paramUserId === currentUid) {
      const { data: d } = await supabase
        .from('daily_mission_progress')
        .select('likes_done, comments_done, stories_done, reads_done, streak_bonus_claimed')
        .eq('user_id', targetUid)
        .eq('date', today)
        .maybeSingle();
      if (d) setDaily({
        likes_done: d.likes_done ?? 0,
        comments_done: d.comments_done ?? 0,
        stories_done: d.stories_done ?? 0,
        reads_done: d.reads_done ?? 0,
        streak_bonus_claimed: d.streak_bonus_claimed ?? false,
      });
    }

    // Cargar perfil para insignias estáticas
    const { data: prof } = await supabase
      .from('profiles')
      .select('is_admin, created_at')
      .eq('id', targetUid)
      .maybeSingle();
    if (prof) {
      setStaticBadges(getStaticBadges(prof.is_admin ?? false, prof.created_at));
    }

    // Cargar insignias de DB (assigned + scope)
    const [{ data: assignedRows }, { data: scopeRows }] = await Promise.all([
      supabase
        .from('user_badges')
        .select('badges ( id, name, description, color, icon, scope )')
        .eq('user_id', targetUid),
      supabase
        .from('badges')
        .select('id, name, description, color, icon, scope')
        .order('name', { ascending: true }),
    ]);

    const assigned: ProfileBadge[] = (assignedRows ?? [])
      .map((r: any) => r.badges)
      .filter(Boolean);

    const assignedIds = new Set(assigned.map((a: any) => a.id));
    (scopeRows ?? []).forEach((b: any) => {
      if (b.scope === 'all_users' && !assignedIds.has(b.id)) {
        assigned.push(b);
        assignedIds.add(b.id);
      }
    });
    if (prof?.is_admin) {
      (scopeRows ?? []).forEach((b: any) => {
        if (b.scope === 'admin_only' && !assignedIds.has(b.id)) {
          assigned.push(b);
          assignedIds.add(b.id);
        }
      });
    }

    setDbBadges(assigned);
    setLoading(false);
  }, [paramUserId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!fontsLoaded || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#7C3AED" />
      </View>
    );
  }

  const currentLevel = getCurrentLevel(gam.xp);
  const nextLevel = getNextLevel(gam.xp);
  const progress = getLevelProgress(gam.xp);
  const xpToNext = nextLevel ? nextLevel.minXP - gam.xp : 0;
  const tc = currentLevel.color;

  const commentsXPToday = Math.floor(daily.comments_done / 2) * XP_PER_2_COMMENTS;
  const storiesXPToday = daily.stories_done * XP_PER_STORY;
  const readsXPToday = daily.reads_done * XP_PER_READ;

  // Combinar todas las insignias (estáticas primero, luego DB)
  const allBadges: Array<{ id: string; name: string; description: string; color: string; icon: string }> = [
    ...staticBadges.map((b) => ({ id: b.id, name: b.name, description: b.description, color: b.color, icon: b.icon })),
    ...dbBadges.map((b) => ({ id: b.id, name: b.name, description: b.description, color: b.color, icon: b.icon ?? 'verified_MI_0' })),
  ];

  const visibleBadges = allBadges.slice(0, BADGES_VISIBLE_LIMIT);
  const overflowCount = allBadges.length - BADGES_VISIBLE_LIMIT;

  return (
    <SafeAreaView style={s.screen} edges={['bottom']}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top, height: 56 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Progreso</Text>
        <View style={s.headerBtn} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Trofeo y nivel ─────────────────────────────────────── */}
        <View style={s.card}>
          <AnimatedTrophy color={tc} icon={currentLevel.icon} />

          <Text style={[s.levelName, { color: tc, fontFamily: 'Risque_400Regular' }]}>
            {currentLevel.name}
          </Text>

          <Text style={s.xpLabel}>
            {gam.xp.toLocaleString()} XP
            {nextLevel ? ` · faltan ${xpToNext} para ${nextLevel.name}` : ' · Nivel máximo'}
          </Text>

          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
          </View>

          {nextLevel && (
            <View style={s.levelRow}>
              <Text style={s.levelHint}>{currentLevel.minXP} XP</Text>
              <Text style={s.levelHint}>{nextLevel.minXP} XP</Text>
            </View>
          )}
        </View>

        {/* ── Natal-IA ──────────────────────────────────────────── */}
        {isOwn && <NatalIABanner />}

        {/* ── Racha ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.streakHeader}>
            <View style={s.streakIconWrap}>
              <MaterialCommunityIcons name="fire" size={26} color="#F97316" />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={s.streakDays}>{gam.streak_days} {gam.streak_days === 1 ? 'día' : 'días'} de racha</Text>
              <Text style={s.streakSub}>Mejor racha: {gam.longest_streak} días</Text>
            </View>
          </View>
          {isOwn && (
            <>
              <View style={s.divider} />
              <View style={s.bonusRow}>
                <MaterialCommunityIcons name="lightning-bolt" size={16} color="#7C3AED" />
                <Text style={s.bonusTxt}>+{XP_STREAK_BONUS} XP por mantener la racha cada día</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Insignias ─────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionLine} />
          <Text style={s.sectionTitle}>INSIGNIAS</Text>
          <View style={s.sectionLine} />
        </View>

        <View style={s.badgesCard}>
          {allBadges.length === 0 ? (
            <Text style={s.noBadgesTxt}>Aún no hay insignias</Text>
          ) : (
            <BadgeGrid
              items={[
                ...visibleBadges.map((b) => ({ type: 'badge' as const, badge: b })),
                ...(overflowCount > 0 ? [{ type: 'overflow' as const, count: overflowCount }] : []),
              ]}
              cols={COLS}
              onPressBadge={(b) => { setSelectedBadge(b); setShowBadgeDetail(true); }}
              onPressOverflow={() => setShowAllBadges(true)}
            />
          )}
        </View>

        {/* ── Misiones de hoy (solo perfil propio) ──────────────── */}
        {isOwn && (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionLine} />
              <Text style={s.sectionTitle}>MISIONES DE HOY</Text>
              <View style={s.sectionLine} />
            </View>

            <MissionRow
              icon="door-open"
              iconSet="mci"
              label="Entrar a la app"
              sublabel="Racha activa"
              xpLabel={`+${XP_STREAK_BONUS} XP`}
              done={daily.streak_bonus_claimed}
              progress={daily.streak_bonus_claimed ? 1 : 0}
              color="#6366F1"
            />

            <MissionRow
              icon="heart"
              iconSet="ion"
              label="Likes dados hoy"
              sublabel={`${daily.likes_done} like${daily.likes_done !== 1 ? 's' : ''} · +${XP_PER_LIKE} XP c/u`}
              xpLabel={`+${daily.likes_done * XP_PER_LIKE} XP`}
              done={daily.likes_done > 0}
              progress={Math.min(daily.likes_done / 5, 1)}
              color="#A78BFA"
            />

            <MissionRow
              icon="chatbubble"
              iconSet="ion"
              label="Comentarios"
              sublabel={`${daily.comments_done} comentario${daily.comments_done !== 1 ? 's' : ''} · +${XP_PER_2_COMMENTS} XP c/2`}
              xpLabel={`+${commentsXPToday} XP`}
              done={daily.comments_done >= 2}
              progress={Math.min(daily.comments_done / 4, 1)}
              color="#60A5FA"
            />

            <MissionRow
              icon="book"
              iconSet="ion"
              label="Subir una historia"
              sublabel={daily.stories_done > 0 ? `${daily.stories_done} historia${daily.stories_done !== 1 ? 's' : ''} · +${XP_PER_STORY} XP c/u` : `+${XP_PER_STORY} XP por historia`}
              xpLabel={`+${storiesXPToday} XP`}
              done={daily.stories_done > 0}
              progress={Math.min(daily.stories_done, 1)}
              color="#34D399"
            />

            <MissionRow
              icon="book-open-variant"
              iconSet="mci"
              label="Leer historias"
              sublabel={daily.reads_done > 0 ? `${daily.reads_done} leída${daily.reads_done !== 1 ? 's' : ''} · +${XP_PER_READ} XP c/u` : `+${XP_PER_READ} XP por leer`}
              xpLabel={`+${readsXPToday} XP`}
              done={daily.reads_done > 0}
              progress={Math.min(daily.reads_done / 3, 1)}
              color="#F59E0B"
            />
          </>
        )}

        {/* ── Todos los niveles ─────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionLine} />
          <Text style={s.sectionTitle}>NIVELES</Text>
          <View style={s.sectionLine} />
        </View>

        {LEVELS.map((lvl) => {
          const reached = gam.xp >= lvl.minXP;
          const isCurrent = currentLevel.level === lvl.level;
          return (
            <View key={lvl.level} style={[s.levelItem, isCurrent && { borderColor: lvl.color + '55' }]}>
              <MaterialCommunityIcons
                name={lvl.icon as any}
                size={22}
                color={reached ? lvl.color : '#2D2D2D'}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.levelItemName, { color: reached ? lvl.color : '#3A3A3A' }]}>
                  {lvl.name}
                </Text>
                <Text style={s.levelItemXP}>{lvl.minXP.toLocaleString()} XP</Text>
              </View>
              {isCurrent && (
                <View style={[s.currentBadge, { backgroundColor: lvl.color + '18', borderColor: lvl.color + '44' }]}>
                  <Text style={[s.currentBadgeTxt, { color: lvl.color }]}>Actual</Text>
                </View>
              )}
              {reached && !isCurrent && (
                <Ionicons name="checkmark-circle" size={18} color="#6366F1" />
              )}
            </View>
          );
        })}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal: todas las insignias */}
      <Modal
        visible={showAllBadges}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAllBadges(false)}
      >
        <View style={md.overlay}>
          <TouchableOpacity style={md.backdrop} onPress={() => setShowAllBadges(false)} />
          <View style={md.sheet}>
            <View style={md.sheetHeader}>
              <Text style={md.sheetTitle}>Todas las insignias</Text>
              <TouchableOpacity onPress={() => setShowAllBadges(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ paddingBottom: 16 }}>
              <BadgeGrid
                items={allBadges.map((b) => ({ type: 'badge' as const, badge: b }))}
                cols={COLS}
                onPressBadge={(b) => { setShowAllBadges(false); setSelectedBadge(b); setShowBadgeDetail(true); }}
                onPressOverflow={() => {}}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: detalle de insignia */}
      <Modal
        visible={showBadgeDetail}
        transparent
        animationType="fade"
        onRequestClose={() => setShowBadgeDetail(false)}
      >
        <View style={md.overlay}>
          <TouchableOpacity style={md.backdrop} onPress={() => setShowBadgeDetail(false)} />
          <View style={md.detailSheet}>
            <TouchableOpacity style={md.closeBtn} onPress={() => setShowBadgeDetail(false)} hitSlop={10}>
              <Ionicons name="close-circle" size={28} color="#F3F4F6" />
            </TouchableOpacity>
            {selectedBadge && (
              <View style={md.detailContent}>
                <View style={[md.detailCircle, { borderColor: selectedBadge.color + '55', backgroundColor: selectedBadge.color + '15' }]}>
                  <BadgeIcon iconKey={selectedBadge.icon} size={44} color={selectedBadge.color} />
                </View>
                <Text style={[md.detailName, { color: selectedBadge.color }]}>{selectedBadge.name}</Text>
                <Text style={md.detailDesc}>{selectedBadge.description}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type BadgeGridItem =
  | { type: 'badge'; badge: { id: string; name: string; description: string; color: string; icon: string } }
  | { type: 'overflow'; count: number };

function BadgeGrid({
  items, cols, onPressBadge, onPressOverflow,
}: {
  items: BadgeGridItem[];
  cols: number;
  onPressBadge: (b: { id: string; name: string; description: string; color: string; icon: string }) => void;
  onPressOverflow: () => void;
}) {
  const rows: BadgeGridItem[][] = [];
  for (let i = 0; i < items.length; i += cols) {
    rows.push(items.slice(i, i + cols));
  }
  return (
    <View style={{ gap: 12 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((item, ci) =>
            item.type === 'overflow' ? (
              <TouchableOpacity
                key="overflow"
                onPress={onPressOverflow}
                style={{ flex: 1, alignItems: 'center' }}
                hitSlop={6}
              >
                <View style={[bg.circle, { borderColor: '#3A3A3A', backgroundColor: '#111' }]}>
                  <Text style={bg.overflowTxt}>+{item.count}</Text>
                </View>
                <Text style={bg.label}>Ver todas</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                key={item.badge.id}
                onPress={() => onPressBadge(item.badge)}
                style={{ flex: 1, alignItems: 'center' }}
                hitSlop={6}
              >
                <View style={[bg.circle, { borderColor: item.badge.color + '55', backgroundColor: item.badge.color + '15' }]}>
                  <BadgeIcon iconKey={item.badge.icon} size={24} color={item.badge.color} />
                </View>
                <Text style={[bg.label, { color: item.badge.color }]} numberOfLines={1}>
                  {item.badge.name}
                </Text>
              </TouchableOpacity>
            )
          )}
          {/* Rellena espacios vacíos en la última fila */}
          {Array(cols - row.length).fill(0).map((_, i) => (
            <View key={`pad-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

function MissionRow({
  icon, iconSet, label, sublabel, xpLabel, done, progress, color,
}: {
  icon: string;
  iconSet: 'ion' | 'mci';
  label: string;
  sublabel: string;
  xpLabel: string;
  done: boolean;
  progress: number;
  color: string;
}) {
  return (
    <View style={[m.row, done && { borderColor: color + '44' }]}>
      <View style={[m.iconWrap, { backgroundColor: color + '18' }]}>
        {iconSet === 'ion'
          ? <Ionicons name={icon as any} size={20} color={done ? color : '#3D3D3D'} />
          : <MaterialCommunityIcons name={icon as any} size={20} color={done ? color : '#3D3D3D'} />
        }
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[m.label, done && { color: '#F3F4F6' }]}>{label}</Text>
        <Text style={m.sub}>{sublabel}</Text>
        <View style={m.track}>
          <View style={[m.fill, { width: `${Math.round(Math.min(progress, 1) * 100)}%` as any, backgroundColor: color }]} />
        </View>
      </View>
      <Text style={[m.xp, { color: done ? color : '#3D3D3D' }]}>{xpLabel}</Text>
    </View>
  );
}

// ── AnimatedTrophy styles
const t = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  ring: {
    position: 'absolute',
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 2, borderColor: '#4B5563',
    backgroundColor: 'transparent',
  },
  circle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#111', borderWidth: 2, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center',
  },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  headerBtn: { width: 32 },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontFamily: 'Risque_400Regular', fontSize: 22,
    color: '#F3F4F6', letterSpacing: 0.5,
  },
  content: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#080808',
    borderRadius: 16, borderWidth: 1,
    borderColor: '#1C1C1C',
    padding: 20, alignItems: 'center',
  },
  levelName: { fontSize: 26, marginTop: 14, letterSpacing: 1 },
  xpLabel: { color: '#4B5563', fontSize: 13, marginTop: 6, textAlign: 'center' },
  progressTrack: {
    width: '100%', height: 7, backgroundColor: '#1A1A1A',
    borderRadius: 4, marginTop: 14, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#7C3AED' },
  levelRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  levelHint: { color: '#2D2D2D', fontSize: 11 },

  streakIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A1208', borderWidth: 1, borderColor: '#3D2A0A',
    alignItems: 'center', justifyContent: 'center',
  },
  streakHeader: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  streakDays: { color: '#F3F4F6', fontSize: 20, fontWeight: '700' },
  streakSub: { color: '#4B5563', fontSize: 13, marginTop: 2 },
  divider: { width: '100%', height: 1, backgroundColor: '#151515', marginVertical: 14 },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '100%' },
  bonusTxt: { color: '#6B7280', fontSize: 13, flex: 1 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: '#141414' },
  sectionTitle: { color: '#2D2D2D', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  badgesCard: {
    backgroundColor: '#080808', borderRadius: 16,
    borderWidth: 1, borderColor: '#1C1C1C',
    padding: 16,
  },
  noBadgesTxt: {
    color: '#3A3A3A', fontSize: 13, textAlign: 'center', paddingVertical: 8,
  },

  levelItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#080808', borderRadius: 12,
    borderWidth: 1, borderColor: '#161616',
    padding: 14,
  },
  levelItemName: { fontSize: 15, fontWeight: '600' },
  levelItemXP: { color: '#2D2D2D', fontSize: 12, marginTop: 2 },
  currentBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  currentBadgeTxt: { fontSize: 11, fontWeight: '700' },
});

const m = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#080808', borderRadius: 14,
    borderWidth: 1, borderColor: '#161616',
    padding: 14,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  sub: { color: '#2D2D2D', fontSize: 12, marginTop: 2 },
  track: {
    width: '100%', height: 4, backgroundColor: '#141414',
    borderRadius: 2, marginTop: 8, overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2 },
  xp: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
});

const bg = StyleSheet.create({
  circle: {
    width: 46, height: 46, borderRadius: 23,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    fontSize: 9, fontWeight: '600',
    marginTop: 3, textAlign: 'center',
    color: '#6B7280',
  },
  overflowTxt: {
    fontSize: 14, fontWeight: '700', color: '#6B7280',
  },
});

const md = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: '#0D0D0D', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: '#1C1C1C',
    padding: 20, maxHeight: '60%',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 16,
  },
  sheetTitle: { color: '#F3F4F6', fontSize: 16, fontWeight: '700' },

  detailSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0D0D0D', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: '#1C1C1C',
    padding: 24, alignItems: 'center',
  },
  closeBtn: { position: 'absolute', top: 16, right: 16 },
  detailContent: { alignItems: 'center', paddingTop: 16, paddingBottom: 24 },
  detailCircle: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  detailName: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  detailDesc: { color: '#6B7280', fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

// app/search/index.tsx
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BadgeIcon } from '../profile/settings';
import { getStaticBadges } from '../../lib/badges';
import { getCurrentLevel } from '../../lib/gamification';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

type StoryCategory = 'mito' | 'leyenda' | 'urbana' | 'otra';

type DBStory = {
  id: string;
  title: string;
  body: string;
  cover_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_id: string;
  category: StoryCategory | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    created_at: string;
    user_gamification?: { xp: number }[] | null;
    user_badges?: any[];
  }[] | null;
};

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_admin: boolean;
  user_gamification?: { xp: number }[] | null;
};

type ListItem =
  | { kind: 'story_header'; label: string }
  | { kind: 'story'; data: DBStory }
  | { kind: 'profile_header' }
  | { kind: 'profile'; data: Profile }
  | { kind: 'discover_header' }
  | { kind: 'empty' };

// ─── Config de categorías ─────────────────────────────────────────────────────

const CATEGORIES: { key: StoryCategory | 'todas'; label: string; icon: string }[] = [
  { key: 'todas',   label: 'Todas',   icon: 'layers-outline' },
  { key: 'mito',    label: 'Mito',    icon: 'lightning-bolt' },
  { key: 'leyenda', label: 'Leyenda', icon: 'map-legend' },
  { key: 'urbana',  label: 'Urbana',  icon: 'city-variant-outline' },
  { key: 'otra',    label: 'Otra',    icon: 'help-rhombus-outline' },
];

const CAT_COLOR: Record<StoryCategory, string> = {
  mito:    '#8B9DC3',
  leyenda: '#A0B4B8',
  urbana:  '#9CA3AF',
  otra:    '#B8A9C9',
};

const CAT_ICON: Record<StoryCategory, string> = {
  mito:    'lightning-bolt',
  leyenda: 'map-legend',
  urbana:  'city-variant-outline',
  otra:    'help-rhombus-outline',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toArray = (p: any) => (Array.isArray(p) ? p : p ? [p] : []);

async function fetchXPForIds(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from('user_gamification').select('user_id, xp').in('user_id', ids);
  return new Map((data ?? []).map((r: any) => [r.user_id, r.xp ?? 0]));
}

async function fetchBadgesForAuthors(authorIds: string[]): Promise<Map<string, any[]>> {
  const map = new Map<string, any[]>();
  if (!authorIds.length) return map;
  const { data } = await supabase
    .from('user_badges')
    .select('user_id, badges ( id, name, description, color, icon, scope )')
    .in('user_id', authorIds);
  (data ?? []).forEach((ub: any) => {
    const arr = map.get(ub.user_id) || [];
    arr.push(ub.badges);
    map.set(ub.user_id, arr);
  });
  return map;
}

function attachBadges(stories: any[], badgesMap: Map<string, any[]>, xpMap?: Map<string, number>): DBStory[] {
  return stories.map((st: any) => {
    const profileArr = toArray(st.profiles);
    const profile0 = profileArr[0] ?? null;
    const authorIsAdmin = profile0?.is_admin ?? false;
    const raw = badgesMap.get(st.author_id) || [];
    const user_badges = raw.filter((b: any) => {
      const scope = b?.scope || 'custom';
      if (scope === 'admin_only') return authorIsAdmin;
      return true;
    });
    const xp = xpMap ? (xpMap.get(st.author_id) ?? 0) : (profile0?.user_gamification?.[0]?.xp ?? 0);
    return { ...st, profiles: [{ ...profile0, user_badges, user_gamification: [{ xp }] }] };
  });
}

// ─── Componentes ──────────────────────────────────────────────────────────────

function CategoryPill({
  cat,
  active,
  onPress,
}: {
  cat: typeof CATEGORIES[number];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.pill, active && styles.pillActive]}
    >
      <MaterialCommunityIcons
        name={cat.icon as any}
        size={13}
        color={active ? '#F3F4F6' : '#6B7280'}
      />
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{cat.label}</Text>
    </TouchableOpacity>
  );
}

function StoryCard({ item, onPress }: { item: DBStory; onPress: () => void }) {
  const profileArr = toArray(item.profiles);
  const p = profileArr[0] ?? {};
  const author = p.display_name?.trim() || 'Autor';
  const avatar = p.avatar_url ?? null;
  const isAdmin = p.is_admin ?? false;
  const createdAt = p.created_at ?? '';
  const authorXP = (p.user_gamification as any)?.[0]?.xp ?? 0;
  const level = getCurrentLevel(authorXP);

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.card}>
      {item.cover_url && (
        <Image source={{ uri: item.cover_url }} style={styles.cardCover} resizeMode="cover" />
      )}
      <View style={styles.cardBody}>
        {/* Author row */}
        <View style={styles.cardAuthorRow}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.cardAvatar} />
          ) : (
            <View style={[styles.cardAvatar, styles.cardAvatarEmpty]}>
              <Ionicons name="person-outline" size={11} color="#6B7280" />
            </View>
          )}
          <Text style={styles.cardAuthorName} numberOfLines={1}>{author}</Text>
          {getStaticBadges(isAdmin, createdAt).map((b) => (
            <BadgeIcon key={b.id} iconKey={b.icon} size={12} color={b.color} />
          ))}
          <MaterialCommunityIcons name={level.icon as any} size={12} color={level.color} />
          {item.category && (
            <View style={[styles.catPill, { borderColor: CAT_COLOR[item.category] + '55' }]}>
              <MaterialCommunityIcons
                name={CAT_ICON[item.category] as any}
                size={9}
                color={CAT_COLOR[item.category]}
              />
              <Text style={[styles.catPillText, { color: CAT_COLOR[item.category] }]}>
                {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

        {/* Excerpt */}
        {!!item.body && (
          <Text style={styles.cardExcerpt} numberOfLines={2}>
            {item.body.replace(/\n/g, ' ').substring(0, 110)}
          </Text>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.metaChip}>
            <Ionicons name="heart-outline" size={13} color="#6B7280" />
            <Text style={styles.metaText}>{item.likes_count ?? 0}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="chatbox-outline" size={13} color="#6B7280" />
            <Text style={styles.metaText}>{item.comments_count ?? 0}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ProfileCard({ profile, onPress }: { profile: Profile; onPress: () => void }) {
  const xp = profile.user_gamification?.[0]?.xp ?? 0;
  const level = getCurrentLevel(xp);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.profileCard}>
      {profile.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatar} />
      ) : (
        <View style={[styles.profileAvatar, styles.profileAvatarEmpty]}>
          <Ionicons name="person-outline" size={18} color="#6B7280" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.profileName} numberOfLines={1}>
            {profile.display_name || 'Usuario'}
          </Text>
          {getStaticBadges(profile.is_admin, profile.created_at).map((b) => (
            <BadgeIcon key={b.id} iconKey={b.icon} size={13} color={b.color} />
          ))}
          <MaterialCommunityIcons name={level.icon as any} size={13} color={level.color} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#3A3A3A" />
    </TouchableOpacity>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonCover} />
      <View style={styles.skeletonBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <View style={styles.skeletonAvatar} />
          <View style={[styles.skeletonLine, { width: '35%' }]} />
        </View>
        <View style={[styles.skeletonLine, { width: '80%', height: 14, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: '95%', marginBottom: 6 }]} />
        <View style={[styles.skeletonLine, { width: '70%' }]} />
      </View>
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [searchText, setSearchText] = useState('');
  const [activeCategory, setActiveCategory] = useState<StoryCategory | 'todas'>('todas');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [listItems, setListItems] = useState<ListItem[]>([]);

  useEffect(() => { loadRandom(); }, []);
  useEffect(() => { if (!searchText.trim()) loadRandom(); }, [activeCategory]);

  async function loadRandom() {
    setLoading(true);
    try {
      let q = supabase
        .from('stories')
        .select(`
          id, title, body, cover_url, likes_count, comments_count,
          created_at, author_id, category,
          profiles!stories_author_id_fkey ( display_name, avatar_url, is_admin, created_at, user_gamification ( xp ) )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (activeCategory !== 'todas') q = q.eq('category', activeCategory);

      const { data } = await q;
      const raw = data ?? [];
      const authorIds = Array.from(new Set(raw.map((s: any) => s.author_id)));
      const [badgesMap, xpMap] = await Promise.all([
        fetchBadgesForAuthors(authorIds),
        fetchXPForIds(authorIds),
      ]);
      const stories = attachBadges(raw, badgesMap, xpMap)
        .sort(() => Math.random() - 0.5)
        .slice(0, 20);

      const items: ListItem[] = [
        { kind: 'discover_header' },
        { kind: 'story_header', label: 'Historias' },
        ...stories.map((s): ListItem => ({ kind: 'story', data: s })),
      ];
      if (!stories.length) items.push({ kind: 'empty' });
      setListItems(items);
    } catch {
      setListItems([{ kind: 'discover_header' }, { kind: 'empty' }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    const q = searchText.trim();
    if (!q) { loadRandom(); return; }

    Keyboard.dismiss();
    setSearching(true);
    const like = `%${q.toLowerCase()}%`;

    try {
      let storiesQ = supabase
        .from('stories')
        .select(`
          id, title, body, cover_url, likes_count, comments_count,
          created_at, author_id, category,
          profiles!stories_author_id_fkey ( display_name, avatar_url, is_admin, created_at, user_gamification ( xp ) )
        `)
        .ilike('title', like)
        .limit(20);
      if (activeCategory !== 'todas') storiesQ = storiesQ.eq('category', activeCategory);

      const [{ data: storiesRaw }, { data: profilesRaw }] = await Promise.all([
        storiesQ,
        supabase
          .from('profiles')
          .select('id, display_name, avatar_url, created_at, is_admin')
          .ilike('display_name', like)
          .limit(10),
      ]);

      const authorIds = Array.from(new Set((storiesRaw ?? []).map((s: any) => s.author_id)));
      const profileIds = (profilesRaw ?? []).map((p: any) => p.id);
      const allIds = Array.from(new Set([...authorIds, ...profileIds]));

      const [badgesMap, xpMap] = await Promise.all([
        fetchBadgesForAuthors(authorIds),
        fetchXPForIds(allIds),
      ]);
      const stories = attachBadges(storiesRaw ?? [], badgesMap, xpMap);
      const profiles = (profilesRaw ?? []).map((p: any) => ({
        ...p,
        user_gamification: [{ xp: xpMap.get(p.id) ?? 0 }],
      })) as Profile[];

      const items: ListItem[] = [];

      if (stories.length) {
        items.push({ kind: 'story_header', label: `Historias (${stories.length})` });
        stories.forEach((s) => items.push({ kind: 'story', data: s }));
      }
      if (profiles.length) {
        items.push({ kind: 'profile_header' });
        profiles.forEach((p) => items.push({ kind: 'profile', data: p }));
      }
      if (!stories.length && !profiles.length) {
        items.push({ kind: 'empty' });
      }

      setListItems(items);
    } catch {
      setListItems([{ kind: 'empty' }]);
    } finally {
      setSearching(false);
    }
  }

  const goStory = useCallback((item: DBStory) => {
    const profileArr = toArray(item.profiles);
    router.push({
      pathname: '/story/[id]',
      params: {
        id: item.id,
        title: item.title,
        author: profileArr[0]?.display_name?.trim() || 'Autor',
        body: item.body,
        cover: item.cover_url ?? '',
        likes: String(item.likes_count ?? 0),
        comments: String(item.comments_count ?? 0),
        source: 'search',
      },
    });
  }, [router]);

  const goProfile = useCallback((id: string) => {
    router.push({ pathname: '/profile/[id]', params: { id } });
  }, [router]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    switch (item.kind) {
      case 'discover_header':
        return (
          <View style={styles.discoverHeader}>
            <Text style={styles.discoverTitle}>Descubrir</Text>
            <Text style={styles.discoverSub}>Historias de mitos, leyendas y más</Text>
          </View>
        );
      case 'story_header':
        return (
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={15} color="#F3F4F6" />
            <Text style={styles.sectionTitle}>{item.label}</Text>
          </View>
        );
      case 'profile_header':
        return (
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <Ionicons name="people-outline" size={15} color="#F3F4F6" />
            <Text style={styles.sectionTitle}>Perfiles</Text>
          </View>
        );
      case 'story':
        return (
          <View style={{ marginBottom: 10 }}>
            <StoryCard item={item.data} onPress={() => goStory(item.data)} />
          </View>
        );
      case 'profile':
        return (
          <View style={{ marginBottom: 8 }}>
            <ProfileCard profile={item.data} onPress={() => goProfile(item.data.id)} />
          </View>
        );
      case 'empty':
        return (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={56} color="#2A2A2A" />
            <Text style={styles.emptyTitle}>
              {searchText.trim() ? 'Sin resultados' : 'Sin historias'}
            </Text>
            {!!searchText.trim() && (
              <Text style={styles.emptySub}>No encontramos nada para "{searchText}"</Text>
            )}
          </View>
        );
      default:
        return null;
    }
  }, [goStory, goProfile, searchText]);

  const keyExtractor = useCallback((item: ListItem, index: number) => {
    if (item.kind === 'story') return `story-${item.data.id}`;
    if (item.kind === 'profile') return `profile-${item.data.id}`;
    return `${item.kind}-${index}`;
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Buscar historias, autores..."
            placeholderTextColor="#6B7280"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoFocus
          />
          {searchText.length > 0 && (
            <TouchableOpacity
              onPress={() => { setSearchText(''); loadRandom(); }}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={17} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
        {searchText.length > 0 && (
          <TouchableOpacity onPress={handleSearch} style={styles.searchBtn} activeOpacity={0.8}>
            {searching
              ? <ActivityIndicator size="small" color="#F3F4F6" />
              : <Text style={styles.searchBtnText}>Buscar</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Categorías */}
      <View style={styles.categoriesWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.key}
              cat={cat}
              active={activeCategory === cat.key}
              onPress={() => setActiveCategory(cat.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Lista */}
      {loading ? (
        <View style={styles.skeletonWrap}>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews={false}
        />
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    paddingHorizontal: 12,
    height: 42,
  },
  input: { flex: 1, color: '#F3F4F6', fontSize: 15 },
  searchBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  searchBtnText: { color: '#F3F4F6', fontSize: 13, fontWeight: '600' },

  categoriesWrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#0F0F0F',
    paddingBottom: 10,
  },
  categoriesScroll: { paddingHorizontal: 12, gap: 8, paddingVertical: 4 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  pillActive: { borderColor: '#2A2A2A', backgroundColor: '#141414' },
  pillText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#F3F4F6' },

  skeletonWrap: { paddingHorizontal: 14, paddingTop: 14, gap: 10 },
  listContent: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 40 },

  discoverHeader: { marginBottom: 16 },
  discoverTitle: { color: '#F3F4F6', fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  discoverSub: { color: '#3A3A3A', fontSize: 13, marginTop: 3 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: { color: '#F3F4F6', fontSize: 15, fontWeight: '700' },

  // Story card
  card: {
    backgroundColor: '#080808',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#181818',
    overflow: 'hidden',
  },
  cardCover: { width: '100%', height: 150 },
  cardBody: { padding: 12, gap: 6 },
  cardAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'nowrap',
  },
  cardAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0F1016',
    borderWidth: 1,
    borderColor: '#1F1F27',
    marginRight: 2,
  },
  cardAvatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardAuthorName: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: 90,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#050505',
    marginLeft: 2,
  },
  catPillText: { fontSize: 9, fontWeight: '600' },
  cardTitle: { color: '#F3F4F6', fontSize: 15, fontWeight: '700', lineHeight: 21 },
  cardExcerpt: { color: '#5A5A5A', fontSize: 12, lineHeight: 17 },
  cardFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#0F0F0F',
    marginTop: 2,
  },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: '#4A4A4A', fontSize: 12, fontWeight: '600' },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#080808',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#181818',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0F1016',
    borderWidth: 1,
    borderColor: '#1F1F27',
  },
  profileAvatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  profileName: { color: '#F3F4F6', fontWeight: '600', fontSize: 14, flexShrink: 1 },

  // Skeleton
  skeletonCard: {
    backgroundColor: '#080808',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#181818',
    overflow: 'hidden',
  },
  skeletonCover: { width: '100%', height: 150, backgroundColor: '#111' },
  skeletonBody: { padding: 12 },
  skeletonAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1A1A1A' },
  skeletonLine: { height: 11, borderRadius: 5, backgroundColor: '#111' },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: { color: '#3A3A3A', fontSize: 18, fontWeight: '700' },
  emptySub: { color: '#2A2A2A', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
});

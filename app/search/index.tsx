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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BadgeIcon } from '../profile/settings';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeInUp,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';

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
    user_badges?: {
      badges: {
        id: string;
        name: string;
        description: string;
        color: string;
        icon: string | null;
        scope?: string;
      };
    }[];
  }[] | null;
};

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_admin: boolean;
};

// ─── Config de categorías ─────────────────────────────────────────────────────

const CATEGORIES: {
  key: StoryCategory | 'todas';
  label: string;
  icon: string;
  color: string;
  activeColor: string;
}[] = [
  { key: 'todas', label: 'Todas', icon: 'layers-outline', color: '#6B7280', activeColor: '#F3F4F6' },
  { key: 'mito', label: 'Mito', icon: 'lightning-bolt', color: '#6B7280', activeColor: '#8B9DC3' },
  { key: 'leyenda', label: 'Leyenda', icon: 'map-legend', color: '#6B7280', activeColor: '#A0B4B8' },
  { key: 'urbana', label: 'Urbana', icon: 'city-variant-outline', color: '#6B7280', activeColor: '#9CA3AF' },
  { key: 'otra', label: 'Otra', icon: 'help-rhombus-outline', color: '#6B7280', activeColor: '#B8A9C9' },
];

const CAT_CONFIG: Record<StoryCategory, { label: string; icon: string; color: string }> = {
  mito:    { label: 'Mito',    icon: 'lightning-bolt',      color: '#8B9DC3' },
  leyenda: { label: 'Leyenda', icon: 'map-legend',          color: '#A0B4B8' },
  urbana:  { label: 'Urbana',  icon: 'city-variant-outline', color: '#9CA3AF' },
  otra:    { label: 'Otra',    icon: 'help-rhombus-outline', color: '#B8A9C9' },
};

// ─── Colores ──────────────────────────────────────────────────────────────────

const C = {
  bg: '#000000',
  card: '#010102',
  cardBorder: '#181818',
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A1AA',
  inputBg: '#0A0A0A',
  categoryBg: '#0A0A0A',
  categoryBorder: '#1F1F27',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toArray = (p: any) => (Array.isArray(p) ? p : p ? [p] : []);

// ─── Componentes ──────────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: StoryCategory }) {
  const cfg = CAT_CONFIG[category];
  if (!cfg) return null;
  return (
    <View style={styles.badge}>
      <MaterialCommunityIcons name={cfg.icon as any} size={10} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function StoryCard({
  item,
  index,
  onPress,
}: {
  item: DBStory;
  index: number;
  onPress: (id: string) => void;
}) {
  const hasCover = !!item.cover_url;
  const profileArr = toArray(item.profiles);
  const author = profileArr[0]?.display_name?.trim() || 'Autor';
  const avatar = profileArr[0]?.avatar_url ?? null;
  const isAdmin = profileArr[0]?.is_admin ?? false;
  const createdAt = profileArr[0]?.created_at ?? '';
  const isEarlyUser = new Date(createdAt) < new Date('2026-01-01');

  const likesCount = item.likes_count ?? 0;
  const commentsCount = item.comments_count ?? 0;

  return (
    <Animated.View
      entering={FadeInUp.duration(400).delay(index * 60).springify()}
      style={{ marginBottom: 12 }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onPress(item.id)}
        style={styles.card}
      >
        {/* Cover Image */}
        {hasCover && (
          <Image source={{ uri: item.cover_url! }} style={styles.cardCover} resizeMode="cover" />
        )}

        {/* Card Content */}
        <View style={[styles.cardContent, !hasCover && styles.cardContentNoCover]}>
          {/* Header: Avatar + Author + Category */}
          <View style={styles.cardHeader}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.cardAvatar} />
            ) : (
              <View style={[styles.cardAvatar, styles.cardAvatarPlaceholder]}>
                <Ionicons name="person-outline" size={12} color="#9CA3AF" />
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.cardAuthor} numberOfLines={1}>{author}</Text>
              {/* Insignias dinámicas */}
              {profileArr[0]?.user_badges
                ?.filter((ub: any) => {
                  const scope = ub.badges?.scope;
                  if (scope === 'admin_only') return isAdmin;
                  if (scope === 'all_users') return true;
                  return scope === 'custom';
                })
                .map((ub: any, idx: number) => (
                  <BadgeIcon
                    key={idx}
                    iconKey={ub.badges?.icon || 'verified_MI_0'}
                    size={12}
                    color={ub.badges?.color || '#F3F4F6'}
                  />
                ))}
            </View>
            {item.category && <CategoryBadge category={item.category} />}
          </View>

          {/* Title */}
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

          {/* Excerpt */}
          {item.body && (
            <Text style={styles.cardExcerpt} numberOfLines={2}>
              {item.body.substring(0, 120)}...
            </Text>
          )}

          {/* Footer: Likes + Comments */}
          <View style={styles.cardFooter}>
            <View style={styles.metaItem}>
              <Ionicons name="heart-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{likesCount}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="chatbox-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{commentsCount}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ProfileCard({
  profile,
  onPress,
}: {
  profile: Profile;
  onPress: (id: string) => void;
}) {
  const isEarlyUser = new Date(profile.created_at) < new Date('2026-01-01');

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(profile.id)}
      style={styles.profileCard}
    >
      {profile.avatar_url ? (
        <Image source={{ uri: profile.avatar_url }} style={styles.profileAvatar} />
      ) : (
        <View style={[styles.profileAvatar, styles.profileAvatarPlaceholder]}>
          <Ionicons name="person-outline" size={16} color="#9CA3AF" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={styles.profileName} numberOfLines={1}>
            {profile.display_name || 'Usuario'}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#6B7280" />
    </TouchableOpacity>
  );
}

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonCover} />
      <View style={styles.skeletonContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <View style={styles.skeletonAvatar} />
          <View style={[styles.skeletonLine, { width: '40%' }]} />
        </View>
        <View style={[styles.skeletonLine, { width: '70%', marginBottom: 6 }]} />
        <View style={[styles.skeletonLine, { width: '90%', marginBottom: 6 }]} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
          <View style={[styles.skeletonLine, { width: 50, height: 14 }]} />
          <View style={[styles.skeletonLine, { width: 50, height: 14 }]} />
        </View>
      </View>
    </View>
  );
}

// ─── Pantalla Principal ───────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [stories, setStories] = useState<DBStory[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<StoryCategory | 'todas'>('todas');
  const [showResults, setShowResults] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Cargar historias aleatorias al iniciar
  useEffect(() => {
    loadRandomStories();
  }, []);

  // Filtrar por categoría
  useEffect(() => {
    if (!searchText.trim()) {
      loadRandomStories();
    }
  }, [activeCategory]);

  async function loadRandomStories() {
    setLoading(true);
    setShowResults(false);

    try {
      let query = supabase
        .from('stories')
        .select(`
          id, title, body, cover_url, likes_count, comments_count,
          created_at, author_id, category,
          profiles!stories_author_id_fkey ( display_name, avatar_url, is_admin, created_at )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (activeCategory !== 'todas') {
        query = query.eq('category', activeCategory);
      }

      const { data, error } = await query;

      if (error || !data) {
        setStories([]);
        setLoading(false);
        setShowResults(true);
        return;
      }

      // Cargar insignias de todos los autores
      const authorIds = Array.from(new Set(data.map((s: any) => s.author_id)));
      const badgesMap = new Map<string, any[]>();
      if (authorIds.length) {
        const { data: allBadges } = await supabase
          .from('user_badges')
          .select(`user_id, badges ( id, name, description, color, icon, scope )`)
          .in('user_id', authorIds);
        (allBadges ?? []).forEach((ub: any) => {
          const arr = badgesMap.get(ub.user_id) || [];
          arr.push(ub.badges);
          badgesMap.set(ub.user_id, arr);
        });
      }

      const storiesWithBadges: DBStory[] = data.map((st: any) => {
        const profileArr = toArray(st.profiles);
        const profile0 = profileArr[0] ?? null;
        const authorId = st.author_id;
        const authorIsAdmin = profile0?.is_admin ?? false;
        const rawBadges = badgesMap.get(authorId) || [];
        const user_badges = rawBadges.filter((b: any) => {
          const scope = b.scope || 'custom';
          if (scope === 'admin_only') return authorIsAdmin;
          if (scope === 'all_users') return true;
          return scope === 'custom';
        });
        return {
          ...st,
          profiles: [{
            ...profile0,
            user_badges,
          }],
        };
      });

      // Shuffle y tomar 15
      const shuffled = storiesWithBadges.sort(() => 0.5 - Math.random()).slice(0, 15);
      setStories(shuffled as unknown as DBStory[]);
    } catch (e) {
      console.error('Error loading stories:', e);
      setStories([]);
    } finally {
      setLoading(false);
      setShowResults(true);
    }
  }

  async function handleSearch() {
    if (!searchText.trim()) {
      loadRandomStories();
      return;
    }

    setSearching(true);
    setShowResults(false);
    const query = `%${searchText.toLowerCase()}%`;

    try {
      // Buscar historias
      let storiesQuery = supabase
        .from('stories')
        .select(`
          id, title, body, cover_url, likes_count, comments_count,
          created_at, author_id, category,
          profiles!stories_author_id_fkey ( display_name, avatar_url, is_admin, created_at )
        `)
        .ilike('title', query)
        .limit(20);

      if (activeCategory !== 'todas') {
        storiesQuery = storiesQuery.eq('category', activeCategory);
      }

      const { data: storiesData } = await storiesQuery;
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, created_at, is_admin')
        .ilike('display_name', query)
        .limit(10);

      // Cargar insignias de los autores de las historias encontradas
      const authorIds = Array.from(new Set((storiesData ?? []).map((s: any) => s.author_id)));
      const badgesMap = new Map<string, any[]>();
      if (authorIds.length) {
        const { data: allBadges } = await supabase
          .from('user_badges')
          .select(`user_id, badges ( id, name, description, color, icon, scope )`)
          .in('user_id', authorIds);
        (allBadges ?? []).forEach((ub: any) => {
          const arr = badgesMap.get(ub.user_id) || [];
          arr.push(ub.badges);
          badgesMap.set(ub.user_id, arr);
        });
      }

      const storiesWithBadges: DBStory[] = (storiesData ?? []).map((st: any) => {
        const profileArr = toArray(st.profiles);
        const profile0 = profileArr[0] ?? null;
        const authorId = st.author_id;
        const authorIsAdmin = profile0?.is_admin ?? false;
        const rawBadges = badgesMap.get(authorId) || [];
        const user_badges = rawBadges.filter((b: any) => {
          const scope = b.scope || 'custom';
          if (scope === 'admin_only') return authorIsAdmin;
          if (scope === 'all_users') return true;
          return scope === 'custom';
        });
        return {
          ...st,
          profiles: [{
            ...profile0,
            user_badges,
          }],
        };
      });

      setStories(storiesWithBadges as unknown as DBStory[]);
      setProfiles((profilesData ?? []) as Profile[]);
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setSearching(false);
      setShowResults(true);
    }
  }

  const handleStoryPress = useCallback((storyId: string) => {
    const story = stories.find(s => s.id === storyId);
    if (!story) return;

    const profileArr = toArray(story.profiles);
    const author = profileArr[0]?.display_name?.trim() || 'Autor';

    router.push({
      pathname: '/story/[id]',
      params: {
        id: story.id,
        title: story.title,
        author,
        body: story.body,
        cover: story.cover_url ?? '',
        likes: String(story.likes_count ?? 0),
        comments: String(story.comments_count ?? 0),
        source: 'search',
      },
    });
  }, [stories, router]);

  const handleProfilePress = useCallback((profileId: string) => {
    router.push({
      pathname: '/profile/[id]',
      params: { id: profileId },
    });
  }, [router]);

  const hasResults = searchText.trim().length > 0 && (stories.length > 0 || profiles.length > 0);
  const isEmpty = !searching && searchText.trim().length > 0 && stories.length === 0 && profiles.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header con buscador ───────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#6B7280" style={styles.searchIcon} />
          <TextInput
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
            <TouchableOpacity onPress={() => { setSearchText(''); }} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Filtros de categorías ─────────────────────────────────────────── */}
      <View style={styles.categoriesSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setActiveCategory(cat.key)}
                style={[
                  styles.categoryBtn,
                  isActive && styles.categoryBtnActive,
                ]}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={cat.icon as any}
                  size={14}
                  color={isActive ? cat.activeColor : '#6B7280'}
                />
                <Text
                  style={[
                    styles.categoryText,
                    isActive && { color: cat.activeColor },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Contenido principal ───────────────────────────────────────────── */}
      {(loading || searching) && (
        <View style={styles.content}>
          <View style={{ gap: 12 }}>
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </View>
        </View>
      )}

      {!loading && !searching && showResults && (
        <FlatList
          ref={flatListRef}
          data={
            searchText.trim().length > 0
              ? [
                  ...(stories.length > 0 ? [{ type: 'stories' }] : []),
                  ...(profiles.length > 0 ? [{ type: 'profiles' }] : []),
                ]
              : [{ type: 'stories' }]
          }
          keyExtractor={(item) => item.type}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            searchText.trim().length === 0 ? (
              <View style={styles.discoverHeader}>
                <Text style={styles.discoverTitle}>Descubrir</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            if (item.type === 'stories') {
              return (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="book-outline" size={16} color="#F3F4F6" />
                    <Text style={styles.sectionTitle}>
                      {searchText.trim().length > 0 ? 'Historias encontradas' : 'Historias'}
                    </Text>
                  </View>
                  {stories.map((story, idx) => (
                    <StoryCard
                      key={story.id}
                      item={story}
                      index={idx}
                      onPress={handleStoryPress}
                    />
                  ))}
                </View>
              );
            }

            if (item.type === 'profiles') {
              return (
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Ionicons name="people-outline" size={16} color="#F3F4F6" />
                    <Text style={styles.sectionTitle}>Perfiles encontrados</Text>
                  </View>
                  {profiles.map((profile) => (
                    <ProfileCard
                      key={profile.id}
                      profile={profile}
                      onPress={handleProfilePress}
                    />
                  ))}
                </View>
              );
            }

            return null;
          }}
          ListEmptyComponent={
            isEmpty ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={64} color="#3F3F46" />
                <Text style={styles.emptyTitle}>Sin resultados</Text>
                <Text style={styles.emptySub}>
                  {`No encontramos nada para "${searchText}"`}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.bg,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  input: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 15,
    maxHeight: 44,
  },

  // Categorías
  categoriesSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  categoriesScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.categoryBg,
    borderWidth: 1,
    borderColor: C.categoryBorder,
  },
  categoryBtnActive: {
    borderColor: '#2C2C33',
    backgroundColor: '#111111',
  },
  categoryText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },

  // Discover Header
  discoverHeader: {
    marginBottom: 20,
    gap: 6,
  },
  discoverTitle: {
    color: C.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  discoverSub: {
    color: C.textSecondary,
    fontSize: 14,
  },

  // Secciones
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionCount: {
    color: C.textSecondary,
    fontSize: 13,
  },

  // Story Card
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  cardCover: {
    width: '100%',
    height: 160,
  },
  cardContent: {
    padding: 12,
    gap: 8,
  },
  cardContentNoCover: {
    paddingTop: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0F1016',
    borderWidth: 1,
    borderColor: '#1F1F27',
  },
  cardAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAuthor: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  cardTitle: {
    color: C.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardExcerpt: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#111',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },

  // Category Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1F1F27',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Profile Card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 8,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F1016',
    borderWidth: 1,
    borderColor: '#1F1F27',
  },
  profileAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: C.textPrimary,
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },

  // Skeleton
  skeletonCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 12,
    overflow: 'hidden',
  },
  skeletonCover: {
    width: '100%',
    height: 160,
    backgroundColor: '#111',
  },
  skeletonContent: {
    padding: 12,
    gap: 6,
  },
  skeletonAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#111',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    color: C.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  emptySub: {
    color: C.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

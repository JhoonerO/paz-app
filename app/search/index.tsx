// app/search/index.tsx
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';


const C = {
  bg: '#0B0B0F',
  card: '#010102',
  cardBorder: '#181818',
  textPrimary: '#F3F4F6',
  textSecondary: '#A1A1AA',
  categoryBg: '#1a1a1a',
  categoryText: '#9CA3AF',
};


type Story = {
  id: string;
  title: string;
  author_name: string;
  cover_url: string | null;
  category: string;
};


type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  is_admin: boolean;
};


function getCategoryIcon(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes('mito')) return <AntDesign name="gitlab" size={14} color="#9CA3AF" />;
  if (cat.includes('leyenda')) return <AntDesign name="dingding" size={14} color="#9CA3AF" />;
  if (cat.includes('urbana')) return <AntDesign name="heat-map" size={14} color="#9CA3AF" />;
  return null;
}


export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchText, setSearchText] = useState('');
  const [stories, setStories] = useState<Story[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    if (searchText.trim().length === 0) {
      setStories([]);
      setProfiles([]);
      setCategories([]);
      return;
    }
    search();
  }, [searchText]);


  async function search() {
    setLoading(true);
    const query = `%${searchText.toLowerCase()}%`;


    try {
      const { data: storiesData } = await supabase
        .from('stories')
        .select('id, title, author_name, cover_url, category')
        .or(`title.ilike.${query},author_name.ilike.${query},category.ilike.${query}`)
        .limit(8);


      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, created_at, is_admin')
        .ilike('display_name', query)
        .limit(8);


      const { data: categoriesData } = await supabase
        .from('stories')
        .select('category');


      setStories(storiesData ?? []);
      setProfiles((profilesData ?? []) as Profile[]);


      const catMap = new Map<string, number>();
      (categoriesData ?? []).forEach((item: any) => {
        const cat = item.category.toLowerCase();
        const searchLower = searchText.toLowerCase();
        if (cat.includes(searchLower)) {
          catMap.set(item.category, (catMap.get(item.category) ?? 0) + 1);
        }
      });


      setCategories(
        Array.from(catMap, ([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
      );
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }


  const hasResults =
    searchText.trim().length > 0 && (stories.length > 0 || profiles.length > 0 || categories.length > 0);
  const isEmpty =
    !loading && searchText.trim().length > 0 && stories.length === 0 && profiles.length === 0 && categories.length === 0;


  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#F3F4F6" />
        </TouchableOpacity>


        <TextInput
          style={s.input}
          placeholder="Buscar historias, autores, categorías..."
          placeholderTextColor="#6B6B78"
          value={searchText}
          onChangeText={setSearchText}
          autoFocus
        />
      </View>


      {loading && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#F3F4F6" />
        </View>
      )}


      {hasResults && !loading && (
        <FlatList
          data={[
            { type: 'categories', label: 'Categorías', icon: 'pricetag-outline' },
            { type: 'stories', label: 'Historias', icon: 'book-outline' },
            { type: 'profiles', label: 'Perfiles', icon: 'person-outline' },
          ].filter(section => {
            if (section.type === 'stories') return stories.length > 0;
            if (section.type === 'profiles') return profiles.length > 0;
            if (section.type === 'categories') return categories.length > 0;
            return false;
          })}
          keyExtractor={(item) => item.type}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={{ marginBottom: 20 }}>
              <View style={s.sectionHeader}>
                <Ionicons name={item.icon as any} size={16} color={C.textPrimary} />
                <Text style={s.sectionTitle}>{item.label}</Text>
              </View>


              {item.type === 'categories' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.name}
                      onPress={() => setSearchText(cat.name)}
                    >
                      <View style={s.categoryPill}>
                        <Text style={s.countBadge}>{cat.count}</Text>
                        {getCategoryIcon(cat.name)}
                        <Text style={s.categoryPillText}>{cat.name}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}


              {item.type === 'stories' && (
                <View style={{ gap: 8 }}>
                  {stories.map(story => (
                    <TouchableOpacity
                      key={story.id}
                      onPress={() =>
                        router.push({
                          pathname: '/story/[id]',
                          params: { id: story.id, title: story.title, author: story.author_name },
                        })
                      }
                    >
                      <View style={s.card}>
                        {story.cover_url && <Image source={{ uri: story.cover_url }} style={s.cardImage} />}
                        <View style={s.cardContent}>
                          <Text style={s.cardTitle} numberOfLines={1}>
                            {story.title}
                          </Text>
                          <View style={s.cardFooter}>
                            <Text style={s.cardAuthor} numberOfLines={1}>
                              {story.author_name}
                            </Text>
                            <View style={s.categoryBadge}>
                              {getCategoryIcon(story.category)}
                              <Text style={s.categoryText}>{story.category}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}


              {item.type === 'profiles' && (
                <View style={{ gap: 8 }}>
                  {profiles.map(profile => {
                    const createdYear = parseInt(profile.created_at.split('-')[0]);
                    const isVerified = createdYear < 2026;


                    return (
                      <TouchableOpacity
                        key={profile.id}
                        onPress={() =>
                          router.push({
                            pathname: '/profile/[id]',
                            params: { id: profile.id },
                          })
                        }
                      >
                        <View style={s.profileCard}>
                          {profile.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
                          ) : (
                            <View style={s.avatarPlaceholder}>
                              <Ionicons name="person-outline" size={16} color="#A1A1AA" />
                            </View>
                          )}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Text style={s.profileName} numberOfLines={1}>
                              {profile.display_name}
                            </Text>
                            {profile.is_admin && (
                              <MaterialIcons name="verified" size={14} color="#FFD700" />
                            )}
                            {isVerified && (
                              <MaterialIcons name="verified" size={14} color="#06B6D4" />
                            )}
                          </View>
                          <View style={{ flex: 1 }} />
                          <Ionicons name="chevron-forward" size={20} color="#6B6B78" />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        />
      )}


      {isEmpty && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="search-outline" size={48} color="#6B6B78" />
          <Text style={s.emptyText}>Sin resultados para "{searchText}"</Text>
        </View>
      )}
    </View>
  );
}


const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000ff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#181818ff',
    backgroundColor: '#000000ff',
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 12,
    color: C.textPrimary,
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: { color: C.textPrimary, fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardImage: { width: 80, height: 80 },
  cardContent: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTitle: { color: C.textPrimary, fontWeight: '700', fontSize: 14 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardAuthor: { color: C.textSecondary, fontSize: 12, flex: 1 },
  categoryBadge: {
    backgroundColor: C.categoryBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: { color: C.categoryText, fontSize: 11, fontWeight: '600' },
  profileCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F1016',
    borderWidth: 1,
    borderColor: '#1F1F27',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: { color: C.textPrimary, fontWeight: '600' },
  categoryPill: {
    backgroundColor: C.categoryBg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  categoryPillText: { color: C.categoryText, fontWeight: '600', fontSize: 13 },
  countBadge: {
    backgroundColor: C.cardBorder,
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyText: { color: C.textSecondary, fontSize: 16, marginTop: 16, textAlign: 'center' },
});

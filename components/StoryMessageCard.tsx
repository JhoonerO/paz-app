import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BadgeIcon } from '../app/profile/settings';

export type StorySnapshot = {
  title: string;
  cover_url: string | null;
  author: string;
  author_avatar: string | null;
  author_badges?: any[];
  author_is_admin?: boolean;
};

type Props = {
  storyId: string | null;
  snapshot: StorySnapshot | null;
  isDeleted?: boolean;
};

export default function StoryMessageCard({ storyId, snapshot, isDeleted }: Props) {
  const router = useRouter();

  // Historia eliminada o sin snapshot
  if (isDeleted || !snapshot) {
    return (
      <View style={c.deleted}>
        <Ionicons name="book-outline" size={14} color="#6B7280" />
        <Text style={c.deletedTxt}>Historia no disponible</Text>
      </View>
    );
  }

  const handlePress = () => {
    if (!storyId) return;
    router.push({
      pathname: '/story/[id]',
      params: {
        id: storyId,
        title: snapshot.title,
        author: snapshot.author,
        body: '',
        cover: snapshot.cover_url ?? '',
        likes: '0',
        comments: '0',
        source: 'chat',
      },
    });
  };

  return (
    <TouchableOpacity style={c.card} onPress={handlePress} activeOpacity={0.85}>
      {/* Portada - solo si existe */}
      {snapshot.cover_url && (
        <Image source={{ uri: snapshot.cover_url }} style={c.cover} resizeMode="cover" />
      )}

      {/* Info */}
      <View style={c.info}>
        <View style={c.authorRow}>
          {snapshot.author_avatar ? (
            <Image source={{ uri: snapshot.author_avatar }} style={c.authorAvatar} />
          ) : (
            <View style={[c.authorAvatar, c.authorAvatarPlaceholder]}>
              <Ionicons name="person-outline" size={10} color="#6B7280" />
            </View>
          )}
          <Text style={c.authorName} numberOfLines={1}>{snapshot.author}</Text>
          {snapshot.author_badges?.map((badge: any, idx: number) => (
            <BadgeIcon
              key={idx}
              iconKey={badge.icon || 'verified_MI_0'}
              size={12}
              color={badge.color || '#F3F4F6'}
            />
          ))}
        </View>

        <Text style={c.title} numberOfLines={2}>{snapshot.title}</Text>

        <View style={c.ctaRow}>
          <Text style={c.ctaTxt}>Ver historia</Text>
          <Ionicons name="chevron-forward" size={13} color="#6B7280" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: '#0d0d0dff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f1f1fff',
    overflow: 'hidden',
    width: 230,
  },
  cover: { width: '100%', height: 110 },
  info: { padding: 10, gap: 3 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  authorAvatar: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1, borderColor: '#2C2C33',
  },
  authorAvatarPlaceholder: {
    backgroundColor: '#1a1a1aff',
    alignItems: 'center', justifyContent: 'center',
  },
  authorName: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', flex: 1 },
  title: { color: '#F3F4F6', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
  ctaTxt: { color: '#6B7280', fontSize: 11 },
  deleted: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 10, backgroundColor: '#0d0d0dff',
    borderRadius: 12, borderWidth: 1, borderColor: '#1f1f1fff',
  },
  deletedTxt: { color: '#6B7280', fontSize: 13, fontStyle: 'italic' },
});

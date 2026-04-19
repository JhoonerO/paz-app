const CACHE_TTL = 2 * 60 * 1000;

type ProfileSnapshot = {
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
  visitedXP: number;
  likesPublic: boolean;
  userBadges: any[];
  stories: any[];
  likedStories: any[];
  timestamp: number;
};

const cache = new Map<string, ProfileSnapshot>();

export function getProfileSnapshot(id: string): ProfileSnapshot | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(id);
    return null;
  }
  return entry;
}

export function setProfileSnapshot(id: string, snap: Omit<ProfileSnapshot, 'timestamp'>) {
  cache.set(id, { ...snap, timestamp: Date.now() });
}

export function invalidateProfileSnapshot(id: string) {
  cache.delete(id);
}

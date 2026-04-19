import { supabase } from './supabase';

type ScopeBadge = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string | null;
  scope: string;
};

const CACHE_TTL = 5 * 60 * 1000;
let cache: ScopeBadge[] | null = null;
let cacheTime = 0;

export async function getScopeBadges(): Promise<ScopeBadge[]> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;
  const { data } = await supabase
    .from('badges')
    .select('id, name, description, color, icon, scope')
    .order('name', { ascending: true });
  cache = (data ?? []) as ScopeBadge[];
  cacheTime = Date.now();
  return cache;
}

export function clearBadgeCache() {
  cache = null;
  cacheTime = 0;
}

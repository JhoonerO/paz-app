// lib/likes.ts
import { supabase } from './supabase';

async function getUid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function fetchLikedSetForFeed(storyIds: string[]): Promise<Set<string>> {
  const uid = await getUid();
  if (!uid || storyIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('story_likes')
    .select('story_id')
    .eq('user_id', uid)
    .in('story_id', storyIds);
  if (error) {
    console.warn('fetchLikedSetForFeed:', error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.story_id as string));
}

export async function isLiked(storyId: string): Promise<boolean> {
  const uid = await getUid();
  if (!uid) return false;
  const { count, error } = await supabase
    .from('story_likes')
    .select('*', { head: true, count: 'exact' })
    .eq('story_id', storyId)
    .eq('user_id', uid);
  if (error) {
    console.warn('isLiked:', error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Inserta el like con UPSERT a través de un `insert(...).select()`:
 * - Si ya existe (PK story_id+user_id), no rompe.
 * - Forzamos retorno para poder detectar fallo real de RLS u otros.
 */
export async function like(storyId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Debes iniciar sesión.');

  const { data, error } = await supabase
    .from('story_likes')
    .insert({ story_id: storyId, user_id: uid })
    .select()
    .maybeSingle(); // fuerza que vuelvan filas o error

  // Ignora duplicado (ya estaba likeada)
  if (error && !/duplicate|already exists/i.test(error.message)) {
    throw error;
  }
  return data;
}

export async function unlike(storyId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Debes iniciar sesión.');
  const { error } = await supabase
    .from('story_likes')
    .delete()
    .eq('story_id', storyId)
    .eq('user_id', uid);
  if (error) throw error;
}

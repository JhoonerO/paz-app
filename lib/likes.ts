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
    return false;
  }
  return (count ?? 0) > 0;
}

export async function like(storyId: string) {
  const uid = await getUid();
  if (!uid) throw new Error('Debes iniciar sesión.');

  const { data, error } = await supabase
    .from('story_likes')
    .insert({ story_id: storyId, user_id: uid })
    .select()
    .maybeSingle();

  if (error && !/duplicate|already exists/i.test(error.message)) {
    throw error;
  }

  supabase.functions.invoke('verificar-dinamicas').catch(() => {});

  // 👇 CREAR NOTIFICACIÓN
  if (data && !error) {
    try {
      const { data: story } = await supabase
        .from('stories')
        .select('author_id')
        .eq('id', storyId)
        .single();

      if (story && story.author_id !== uid) {
        await supabase
          .from('notifications')
          .insert({
            user_id: story.author_id,
            actor_id: uid,
            type: 'like',
            story_id: storyId,
            read: false
          });
      }
    } catch {
      // notificación no crítica
    }
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

  // 👇 ELIMINAR NOTIFICACIÓN
  try {
    await supabase
      .from('notifications')
      .delete()
      .eq('story_id', storyId)
      .eq('actor_id', uid)
      .eq('type', 'like');
  } catch {
    // notificación no crítica
  }
}

// lib/comments.ts
import { supabase } from './supabase';

export async function addComment(storyId: string, text: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión.');

  const { error } = await supabase
    .from('story_comments')
    .insert({
      story_id: storyId,
      user_id: user.id,
      text: text.trim()
    });

  if (error) throw error;
}
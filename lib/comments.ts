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

  // 👇 CREAR NOTIFICACIÓN
  try {
    const { data: story } = await supabase
      .from('stories')
      .select('author_id')
      .eq('id', storyId)
      .single();

    if (story && story.author_id !== user.id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: story.author_id,
          actor_id: user.id,
          type: 'comment',
          story_id: storyId,
          read: false
        });
    }
  } catch (err) {
    console.warn('Error creating comment notification:', err);
  }
}

// lib/notifications.ts
import { supabase } from './supabase';

export async function createNotification({
  type,
  storyId,
  targetUserId,
}: {
  type: 'like' | 'comment';
  storyId: string;
  targetUserId: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Evitar notificarte a ti mismo
  if (user.id === targetUserId) return;

  await supabase.from('notifications').insert({
    type,
    story_id: storyId,
    user_id: targetUserId,   // quien recibe la notificación
    actor_id: user.id,       // quien hizo la acción
    read: false,
  });
}
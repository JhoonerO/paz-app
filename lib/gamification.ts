import { supabase } from './supabase';

export const XP_PER_LIKE = 10;
export const XP_PER_2_COMMENTS = 15;
export const XP_PER_STORY = 20;
export const XP_STREAK_BONUS = 5;
export const XP_PER_READ = 8;

export type LevelTier = {
  level: number;
  name: string;
  minXP: number;
  color: string;
  icon: string;
};

export const LEVELS: LevelTier[] = [
  { level: 1,  name: 'Bronce I',     minXP: 0,      color: '#CD7F32', icon: 'trophy-outline' },
  { level: 2,  name: 'Bronce II',    minXP: 150,    color: '#C08030', icon: 'trophy' },
  { level: 3,  name: 'Plata I',      minXP: 400,    color: '#A8A8A8', icon: 'trophy-variant-outline' },
  { level: 4,  name: 'Plata II',     minXP: 800,    color: '#C0C0C0', icon: 'trophy-variant' },
  { level: 5,  name: 'Oro I',        minXP: 1400,   color: '#FFD700', icon: 'medal-outline' },
  { level: 6,  name: 'Oro II',       minXP: 2200,   color: '#FFC200', icon: 'medal' },
  { level: 7,  name: 'Esmeralda I',  minXP: 3500,   color: '#34D399', icon: 'crown-outline' },
  { level: 8,  name: 'Esmeralda II', minXP: 5500,   color: '#10B981', icon: 'crown' },
  { level: 9,  name: 'Platino I',    minXP: 8000,   color: '#E2E8F0', icon: 'diamond-outline' },
  { level: 10, name: 'Platino II',   minXP: 12000,  color: '#CBD5E1', icon: 'diamond-stone' },
  { level: 11, name: 'Diamante',     minXP: 18000,  color: '#7DD3FC', icon: 'star-four-points' },
  { level: 12, name: 'Cósmico',      minXP: 30000,  color: '#C084FC', icon: 'orbit' },
];

export function getCurrentLevel(xp: number): LevelTier {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXP) current = lvl;
    else break;
  }
  return current;
}

export function getNextLevel(xp: number): LevelTier | null {
  const current = getCurrentLevel(xp);
  return LEVELS.find(l => l.level === current.level + 1) ?? null;
}

export function getLevelProgress(xp: number): number {
  const current = getCurrentLevel(xp);
  const next = getNextLevel(xp);
  if (!next) return 1;
  const range = next.minXP - current.minXP;
  const earned = xp - current.minXP;
  return Math.min(earned / range, 1);
}

export function formatCoins(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)} Lukas`;
  return `${amount} Pesos`;
}

// Colombia = UTC-5; el día cambia a medianoche hora colombiana
function todayStr(): string {
  const now = new Date();
  const colombiaOffset = -5 * 60;
  const local = new Date(now.getTime() + (colombiaOffset - now.getTimezoneOffset()) * 60000);
  return local.toISOString().split('T')[0];
}

async function ensureGamification(userId: string) {
  const { data } = await supabase
    .from('user_gamification')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) {
    const { data: created } = await supabase
      .from('user_gamification')
      .insert({ user_id: userId })
      .select('*')
      .single();
    return created;
  }
  return data;
}

async function ensureDailyProgress(userId: string) {
  const today = todayStr();
  const { data } = await supabase
    .from('daily_mission_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();
  if (!data) {
    const { data: created } = await supabase
      .from('daily_mission_progress')
      .insert({ user_id: userId, date: today })
      .select('*')
      .single();
    return created;
  }
  return data;
}

async function incrementXP(userId: string, amount: number) {
  const { data: g } = await supabase
    .from('user_gamification')
    .select('xp')
    .eq('user_id', userId)
    .single();
  await supabase
    .from('user_gamification')
    .update({ xp: (g?.xp ?? 0) + amount, updated_at: new Date().toISOString() })
    .eq('user_id', userId);
}

export async function checkAndUpdateStreak(
  userId: string
): Promise<{ streakDays: number; xpEarned: number }> {
  try {
    const g = await ensureGamification(userId);
    const today = todayStr();

    if (g?.last_activity_date === today) {
      return { streakDays: g.streak_days ?? 1, xpEarned: 0 };
    }

    let newStreak = 1;
    if (g?.last_activity_date) {
      const diffDays = Math.round(
        (new Date(today).getTime() - new Date(g.last_activity_date).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) newStreak = (g.streak_days ?? 0) + 1;
    }

    const newLongest = Math.max(newStreak, g?.longest_streak ?? 0);
    const daily = await ensureDailyProgress(userId);
    let xpEarned = 0;

    if (!daily?.streak_bonus_claimed) {
      xpEarned = XP_STREAK_BONUS;
      await supabase
        .from('daily_mission_progress')
        .update({ streak_bonus_claimed: true })
        .eq('user_id', userId)
        .eq('date', today);
    }

    await supabase
      .from('user_gamification')
      .update({
        streak_days: newStreak,
        longest_streak: newLongest,
        last_activity_date: today,
        xp: (g?.xp ?? 0) + xpEarned,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return { streakDays: newStreak, xpEarned };
  } catch {
    return { streakDays: 0, xpEarned: 0 };
  }
}

export async function awardLikeXP(userId: string): Promise<void> {
  try {
    await ensureGamification(userId);
    const daily = await ensureDailyProgress(userId);
    const today = todayStr();
    await Promise.all([
      supabase
        .from('daily_mission_progress')
        .update({ likes_done: (daily?.likes_done ?? 0) + 1 })
        .eq('user_id', userId)
        .eq('date', today),
      incrementXP(userId, XP_PER_LIKE),
    ]);
  } catch {}
}

export async function awardCommentXP(userId: string): Promise<void> {
  try {
    await ensureGamification(userId);
    const daily = await ensureDailyProgress(userId);
    const today = todayStr();
    const newCount = (daily?.comments_done ?? 0) + 1;
    await supabase
      .from('daily_mission_progress')
      .update({ comments_done: newCount })
      .eq('user_id', userId)
      .eq('date', today);
    if (newCount % 2 === 0) {
      await incrementXP(userId, XP_PER_2_COMMENTS);
    }
  } catch {}
}

export async function awardStoryXP(userId: string): Promise<void> {
  try {
    await ensureGamification(userId);
    const daily = await ensureDailyProgress(userId);
    const today = todayStr();
    await Promise.all([
      supabase
        .from('daily_mission_progress')
        .update({ stories_done: (daily?.stories_done ?? 0) + 1 })
        .eq('user_id', userId)
        .eq('date', today),
      incrementXP(userId, XP_PER_STORY),
    ]);
  } catch {}
}

// Devuelve true si se otorgó XP (primera lectura), false si ya la había leído
export async function awardReadXP(
  userId: string,
  storyId: string
): Promise<boolean> {
  try {
    await ensureGamification(userId);

    // Insertar en story_reads — falla silenciosamente si ya existe (unique constraint)
    const { error } = await supabase
      .from('story_reads')
      .insert({ user_id: userId, story_id: storyId });

    // error.code 23505 = unique_violation → ya leyó esta historia antes
    if (error) return false;

    const daily = await ensureDailyProgress(userId);
    const today = todayStr();

    await Promise.all([
      supabase
        .from('daily_mission_progress')
        .update({ reads_done: (daily?.reads_done ?? 0) + 1 })
        .eq('user_id', userId)
        .eq('date', today),
      incrementXP(userId, XP_PER_READ),
    ]);

    return true;
  } catch {
    return false;
  }
}

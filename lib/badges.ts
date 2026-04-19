export type StaticBadge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
};

export const ADMIN_BADGE: StaticBadge = {
  id: 'admin',
  name: 'Admin',
  description: 'Creador o moderador de U-PAZ. Estas personas mantienen viva la comunidad, cuidan el contenido y trabajan entre bastidores para que todo funcione. Si ves esta insignia, estás frente a alguien que construye esto contigo.',
  icon: 'verified_MI_0',
  color: '#FBBF24',
};

export const TESTER_BADGE: StaticBadge = {
  id: 'tester',
  name: 'Tester',
  description: 'Estuviste aquí antes de que terminara el 2025, cuando U-PAZ todavía era un sueño en construcción. Gracias por creer desde el principio, por explorar, reportar y aguantar los bugs con paciencia. Sin ti esto no sería lo que es hoy.',
  icon: 'verified_MI_0',
  color: '#60A5FA',
};

export function getStaticBadges(
  isAdmin: boolean,
  createdAt: string | null | undefined
): StaticBadge[] {
  const badges: StaticBadge[] = [];
  if (isAdmin) badges.push(ADMIN_BADGE);
  if (createdAt && new Date(createdAt) < new Date('2026-01-01')) badges.push(TESTER_BADGE);
  return badges;
}

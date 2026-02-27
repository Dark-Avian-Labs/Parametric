// `home` and `buildOverview` intentionally resolve to the same route.
export const APP_PATHS = {
  home: '/builder',
  buildOverview: '/builder',
  buildNew: '/builder/new/:equipmentType/:equipmentId',
  buildEdit: '/builder/:buildId',
  admin: '/admin',
  profile: '/profile',
  login: '/login',
  legal: '/legal',
} as const;

export function buildNewPath(
  equipmentType: string,
  equipmentId: string,
): string {
  return `/builder/new/${encodeURIComponent(equipmentType)}/${encodeURIComponent(equipmentId)}`;
}

export function buildEditPath(buildId: string): string {
  return `/builder/${encodeURIComponent(buildId)}`;
}

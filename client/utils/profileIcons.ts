const PROFILE_ICON_MODULES = import.meta.glob('../assets/profile-icons/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const MIN_AVATAR_ID = 1;
export const MAX_AVATAR_ID = 16;
export const DEFAULT_AVATAR_ID = MIN_AVATAR_ID;

const PROFILE_ICON_BY_ID: Record<number, string> = {};

for (const [path, src] of Object.entries(PROFILE_ICON_MODULES)) {
  const match = path.match(/\/(\d+)\.png$/);
  if (!match) continue;
  const id = Number(match[1]);
  if (Number.isInteger(id) && id >= MIN_AVATAR_ID && id <= MAX_AVATAR_ID) {
    PROFILE_ICON_BY_ID[id] = src;
  }
}

export function normalizeAvatarId(value: unknown): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= MIN_AVATAR_ID && parsed <= MAX_AVATAR_ID) {
    return parsed;
  }
  return DEFAULT_AVATAR_ID;
}

export function getProfileIconSrc(value: unknown): string {
  const avatarId = normalizeAvatarId(value);
  return PROFILE_ICON_BY_ID[avatarId] ?? PROFILE_ICON_BY_ID[DEFAULT_AVATAR_ID] ?? '';
}

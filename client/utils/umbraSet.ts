import type { Mod, ModSlot } from '../types/warframe';

const UMBRA_MOD_SET_MARKER = 'UmbraModSet';

export function parseSetStatsTiers(raw: string | undefined | null): string[] | null {
  if (raw == null || String(raw).trim() === '') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const lines = parsed.filter((x): x is string => typeof x === 'string');
      return lines.length > 0 ? lines : null;
    }
    if (parsed && typeof parsed === 'object') {
      const rec = parsed as Record<string, unknown>;
      const entries = Object.entries(rec).sort(([a], [b]) => Number(a) - Number(b));
      const lines = entries.map(([, v]) => v).filter((x): x is string => typeof x === 'string');
      return lines.length > 0 ? lines : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function isUmbraSelfScalingSetMod(mod: Mod | undefined): boolean {
  if (!mod) return false;
  if (mod.mod_set?.includes(UMBRA_MOD_SET_MARKER)) return true;
  if (mod.unique_name?.includes(UMBRA_MOD_SET_MARKER)) return true;
  if (mod.name?.startsWith('Umbral ')) return true;
  return false;
}

export function getUmbraTierStatBlockAtMaxRank(
  mod: Mod,
  rank: number,
  umbraSetEquippedCount: number | undefined,
): string | null {
  const fusionLimit = mod.fusion_limit ?? 0;
  const atMaxRank = fusionLimit > 0 && rank >= fusionLimit;
  if (
    !isUmbraSelfScalingSetMod(mod) ||
    !atMaxRank ||
    umbraSetEquippedCount == null ||
    !mod.set_stats
  ) {
    return null;
  }
  const setStats = parseSetStatsTiers(mod.set_stats);
  if (!setStats?.length) return null;
  const tier = Math.min(Math.max(umbraSetEquippedCount, 1), setStats.length);
  const block = setStats[tier - 1]?.trim();
  return block || null;
}

export function countEquippedUmbraSetMods(slots: ModSlot[]): number {
  let n = 0;
  for (const slot of slots) {
    if (slot.mod && isUmbraSelfScalingSetMod(slot.mod)) n += 1;
  }
  return n;
}

export function countEquippedUmbraSetModsFromModList(mods: Mod[]): number {
  let n = 0;
  for (const mod of mods) {
    if (isUmbraSelfScalingSetMod(mod)) n += 1;
  }
  return n;
}

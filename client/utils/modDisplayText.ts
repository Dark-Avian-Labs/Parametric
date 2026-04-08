import type { Mod } from '../types/warframe';
import { sanitizeDisplayTextKeepDamageTokens } from './damageTypeTokens';
import {
  getUmbraTierStatBlockAtMaxRank,
  isUmbraSelfScalingSetMod,
  parseSetStatsTiers,
} from './umbraSet';

export interface ModCardDisplayTexts {
  mainDescription: string;
  setBonusDescription: string;
  effectiveSetRank: number;
}

function parseDescriptionJsonAtRank(mod: Mod, rank: number): string {
  if (!mod.description) return '';
  try {
    const descriptions: string[] = JSON.parse(mod.description);
    if (!descriptions.length) return '';
    return descriptions[Math.min(rank, descriptions.length - 1)] ?? '';
  } catch {
    return mod.description ?? '';
  }
}

export function getModCardDisplayTexts(
  mod: Mod,
  rank: number,
  opts: { umbraSetEquippedCount?: number; setRank?: number } = {},
): ModCardDisplayTexts {
  const maxSetRank = mod.set_num_in_set ?? 0;
  const isUmbra = isUmbraSelfScalingSetMod(mod);
  const umbraCount = opts.umbraSetEquippedCount;

  const effectiveSetRank =
    isUmbra && umbraCount != null && maxSetRank > 0
      ? Math.min(Math.max(umbraCount, 1), maxSetRank)
      : (opts.setRank ?? (maxSetRank > 0 ? 1 : 0));

  const tierBlock = getUmbraTierStatBlockAtMaxRank(mod, rank, umbraCount);
  if (tierBlock != null) {
    return {
      mainDescription: sanitizeDisplayTextKeepDamageTokens(tierBlock),
      setBonusDescription: '',
      effectiveSetRank,
    };
  }

  const rankBody = parseDescriptionJsonAtRank(mod, rank);
  const mainDescription = sanitizeDisplayTextKeepDamageTokens(rankBody);

  let setBonusDescription = '';
  if (!isUmbra && mod.set_stats && maxSetRank > 0) {
    const setStats = parseSetStatsTiers(mod.set_stats);
    if (setStats?.length) {
      const idx = Math.min(Math.max(effectiveSetRank - 1, 0), setStats.length - 1);
      setBonusDescription = sanitizeDisplayTextKeepDamageTokens(setStats[idx] ?? '');
    }
  }

  return { mainDescription, setBonusDescription, effectiveSetRank };
}

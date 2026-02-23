import { sanitizeDisplayText } from './sanitizeDisplayText';
import type { Arcane } from '../components/ModBuilder/ArcaneSlots';

export function getMaxRank(arcane: Arcane): number {
  try {
    if (arcane.level_stats) {
      const stats = JSON.parse(arcane.level_stats);
      return Array.isArray(stats) ? stats.length - 1 : 5;
    }
  } catch {
    // ignored
  }
  return 5;
}

/**
 * Extract description text for an arcane at a given rank.
 * If rank is omitted, uses the max rank.
 */
export function getArcaneDescription(arcane: Arcane, rank?: number): string {
  try {
    if (arcane.level_stats) {
      const stats = JSON.parse(arcane.level_stats);
      if (Array.isArray(stats) && stats.length > 0) {
        const idx =
          rank != null ? Math.min(rank, stats.length - 1) : stats.length - 1;
        const entry = stats[idx];
        if (typeof entry === 'object' && entry.stats) {
          return sanitizeDisplayText((entry.stats as string[]).join(' '));
        }
        if (typeof entry === 'string') return sanitizeDisplayText(entry);
      }
    }
  } catch {
    // ignored
  }
  return '';
}

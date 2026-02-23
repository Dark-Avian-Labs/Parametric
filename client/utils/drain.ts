import {
  AP_ANY,
  AP_UMBRA,
  type ModSlot,
  type SlotType,
} from '../types/warframe';

/**
 * Universal (AP_ANY) matches every polarity except Umbra.
 * AP_ANY + AP_UMBRA is treated as neutral (no bonus, no penalty).
 */
function polarityMatchResult(
  a: string,
  b: string,
): 'match' | 'neutral' | 'mismatch' {
  if (a === b) return 'match';
  if (a === AP_ANY || b === AP_ANY) {
    if (a === AP_UMBRA || b === AP_UMBRA) return 'neutral';
    return 'match';
  }
  return 'mismatch';
}

/**
 * Calculate the effective drain of a mod in a given slot,
 * accounting for polarity matching.
 *
 * Rules:
 * - Matching polarity: drain halved, rounded UP  (e.g. 14 → 7, 9 → 5)
 * - Non-matching polarity: drain increased by 25%, rounded mathematically
 *   (0-1 → +0, 2-5 → +1, 6-9 → +2, 10-13 → +3, 14-16 → +4, etc.)
 * - Neutral (universal vs umbra): drain unchanged, same as no polarity
 * - No polarity on slot: drain is unchanged
 *
 * Aura, Stance, and Posture mods ADD capacity instead of draining it.
 * - Matching polarity DOUBLES the bonus
 * - Non-matching polarity REDUCES bonus by 25%, rounded mathematically
 */
export function calculateEffectiveDrain(
  baseDrain: number,
  modRank: number,
  fusionLimit: number,
  slotPolarity: string | undefined,
  modPolarity: string | undefined,
  slotType: SlotType,
): number {
  const clampedRank = Math.min(modRank, fusionLimit);
  const absDrain = Math.abs(baseDrain) + clampedRank;

  if (!slotPolarity || !modPolarity) {
    return isCapacitySlot(slotType) ? -absDrain : absDrain;
  }

  const result = polarityMatchResult(slotPolarity, modPolarity);

  if (result === 'neutral') {
    return isCapacitySlot(slotType) ? -absDrain : absDrain;
  }

  if (result === 'match') {
    if (isCapacitySlot(slotType)) {
      return -(absDrain * 2);
    }
    return Math.ceil(absDrain / 2);
  }

  // Mismatch
  if (isCapacitySlot(slotType)) {
    const reduction = Math.round(absDrain * 0.25);
    return -(absDrain - reduction);
  }
  const increase = Math.round(absDrain * 0.25);
  return absDrain + increase;
}

/**
 * Capacity slots (Aura, Stance, Posture) add capacity
 * rather than consuming it.
 */
export function isCapacitySlot(type: SlotType): boolean {
  return type === 'aura' || type === 'stance' || type === 'posture';
}

/**
 * Calculate total mod capacity usage for a build.
 *
 * @returns Object with totalDrain, capacityBonus, baseCapacity, and remaining.
 */
export function calculateTotalCapacity(
  slots: ModSlot[],
  baseCapacity: number = 30,
  orokinReactor: boolean = false,
): {
  baseCapacity: number;
  capacityBonus: number;
  totalDrain: number;
  remaining: number;
} {
  const effectiveBase = orokinReactor ? baseCapacity * 2 : baseCapacity;
  let capacityBonus = 0;
  let totalDrain = 0;

  for (const slot of slots) {
    if (!slot.mod) continue;

    const drain = calculateEffectiveDrain(
      slot.mod.base_drain ?? 0,
      slot.rank ?? slot.mod.fusion_limit ?? 0,
      slot.mod.fusion_limit ?? 0,
      slot.polarity,
      slot.mod.polarity,
      slot.type,
    );

    if (drain < 0) {
      // This is a capacity slot (aura/stance/posture) — adds capacity
      capacityBonus += Math.abs(drain);
    } else {
      totalDrain += drain;
    }
  }

  return {
    baseCapacity: effectiveBase,
    capacityBonus,
    totalDrain,
    remaining: effectiveBase + capacityBonus - totalDrain,
  };
}

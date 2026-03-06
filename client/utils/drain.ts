import {
  AP_ANY,
  AP_UMBRA,
  type ModSlot,
  type SlotType,
} from '../types/warframe';

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

  if (isCapacitySlot(slotType)) {
    const reduction = Math.round(absDrain * 0.25);
    return -(absDrain - reduction);
  }
  const increase = Math.round(absDrain * 0.25);
  return absDrain + increase;
}

export function isCapacitySlot(type: SlotType): boolean {
  return type === 'aura' || type === 'stance' || type === 'posture';
}

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

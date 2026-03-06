import { aggregateAllMods } from './modStatParser';
import type { Warframe, ModSlot } from '../types/warframe';

export interface StatPair {
  base: number;
  modded: number;
}

export interface WarframeCalcResult {
  health: StatPair;
  shield: StatPair;
  armor: StatPair;
  energy: StatPair;
  sprintSpeed: StatPair;
  abilityStrength: StatPair;
  abilityDuration: StatPair;
  abilityEfficiency: StatPair;
  abilityRange: StatPair;
}

export function calculateWarframeStats(
  warframe: Warframe,
  slots: ModSlot[],
): WarframeCalcResult {
  const mods = aggregateAllMods(slots);

  const apply = (base: number, mult: number): StatPair => ({
    base,
    modded: base * (1 + mult),
  });

  const applyPercent = (basePct: number, addPct: number): StatPair => ({
    base: basePct,
    modded: basePct + addPct * 100,
  });

  return {
    health: apply(warframe.health ?? 0, mods.health),
    shield: apply(warframe.shield ?? 0, mods.shield),
    armor: apply(warframe.armor ?? 0, mods.armor),
    energy: apply(warframe.power ?? 0, mods.energy),
    sprintSpeed: apply(warframe.sprint_speed ?? 1, mods.sprintSpeed),
    abilityStrength: applyPercent(100, mods.abilityStrength),
    abilityDuration: applyPercent(100, mods.abilityDuration),
    abilityEfficiency: applyPercent(100, mods.abilityEfficiency),
    abilityRange: applyPercent(100, mods.abilityRange),
  };
}

import { describe, it, expect } from 'vitest';

import type { Warframe, Mod, ModSlot } from '../../types/warframe';
import { calculateWarframeStats } from '../warframeCalc';

function makeWarframe(overrides?: Partial<Warframe>): Warframe {
  return {
    unique_name: '/test/warframe',
    name: 'Test Frame',
    health: 300,
    shield: 300,
    armor: 200,
    power: 150,
    sprint_speed: 1.0,
    mastery_req: 0,
    ...overrides,
  };
}

function makeMod(descriptions: string[]): Mod {
  return {
    unique_name: '/test/mod',
    name: 'Test',
    description: JSON.stringify(descriptions),
    fusion_limit: descriptions.length - 1,
  };
}

describe('calculateWarframeStats', () => {
  it('returns base values with no mods', () => {
    const result = calculateWarframeStats(makeWarframe(), []);
    expect(result.health.base).toBe(300);
    expect(result.health.modded).toBe(300);
    expect(result.abilityStrength.base).toBe(100);
    expect(result.abilityStrength.modded).toBe(100);
  });

  it('applies health mod correctly', () => {
    const slots: ModSlot[] = [
      { index: 0, type: 'general', mod: makeMod(['+100% Health']), rank: 0 },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.health.modded).toBe(600);
  });

  it('applies shield mod correctly', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+100% Shield Capacity']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.shield.modded).toBe(600);
  });

  it('applies armor mod correctly', () => {
    const slots: ModSlot[] = [
      { index: 0, type: 'general', mod: makeMod(['+100% Armor']), rank: 0 },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.armor.modded).toBe(400);
  });

  it('applies sprint speed mod correctly', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+30% Sprint Speed']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.sprintSpeed.modded).toBeCloseTo(1.3);
  });

  it('applies ability strength mod correctly', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+30% Ability Strength']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.abilityStrength.modded).toBe(130);
  });

  it('stacks multiple ability mods', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+30% Ability Strength']),
        rank: 0,
      },
      {
        index: 1,
        type: 'general',
        mod: makeMod(['+30% Ability Duration']),
        rank: 0,
      },
      {
        index: 2,
        type: 'general',
        mod: makeMod(['+30% Ability Efficiency']),
        rank: 0,
      },
      {
        index: 3,
        type: 'general',
        mod: makeMod(['+45% Ability Range']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.abilityStrength.modded).toBe(130);
    expect(result.abilityDuration.modded).toBe(130);
    expect(result.abilityEfficiency.modded).toBe(130);
    expect(result.abilityRange.modded).toBe(145);
  });

  it('handles negative ability mods (e.g. Blind Rage drawback)', () => {
    const slots: ModSlot[] = [
      {
        index: 0,
        type: 'general',
        mod: makeMod(['+99% Ability Strength\n-55% Ability Efficiency']),
        rank: 0,
      },
    ];
    const result = calculateWarframeStats(makeWarframe(), slots);
    expect(result.abilityStrength.modded).toBeCloseTo(199);
    expect(result.abilityEfficiency.modded).toBeCloseTo(45);
  });

  it('handles missing warframe stats gracefully', () => {
    const wf = makeWarframe({ health: undefined, shield: undefined });
    const result = calculateWarframeStats(wf, []);
    expect(result.health.base).toBe(0);
    expect(result.shield.base).toBe(0);
  });
});

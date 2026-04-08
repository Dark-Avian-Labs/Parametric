import { describe, it, expect } from 'vitest';

import type { Mod } from '../../types/warframe';
import { getModCardDisplayTexts } from '../modDisplayText';

describe('getModCardDisplayTexts', () => {
  it('puts Umbral tier text in main body and leaves set-bonus strip empty', () => {
    const mod: Mod = {
      unique_name: '/u/umbra',
      name: 'Umbral Vitality',
      mod_set: '/Lotus/Upgrades/ModSets/Umbra/UmbraModSet',
      description: JSON.stringify(['+10 Health', '+440 Health']),
      set_stats: JSON.stringify(['+100 Health', '+130 Health', '+180 Health']),
      set_num_in_set: 3,
      fusion_limit: 1,
    };
    const { mainDescription, setBonusDescription, effectiveSetRank } = getModCardDisplayTexts(mod, 1, {
      umbraSetEquippedCount: 3,
    });
    expect(mainDescription).toContain('180');
    expect(setBonusDescription).toBe('');
    expect(effectiveSetRank).toBe(3);
  });

  it('uses rank JSON for non-Umbral set mod and set_stats for the set strip', () => {
    const mod: Mod = {
      unique_name: '/u/augur',
      name: 'Augur Message',
      description: JSON.stringify(['+10% Ability Strength']),
      set_stats: JSON.stringify(['Set A', 'Set B', 'Set C']),
      set_num_in_set: 3,
      fusion_limit: 5,
    };
    const { mainDescription, setBonusDescription } = getModCardDisplayTexts(mod, 0, {
      setRank: 2,
    });
    expect(mainDescription).toContain('10%');
    expect(setBonusDescription).toBe('Set B');
  });

  it('uses rank JSON when Umbral tier does not apply (below max rank)', () => {
    const mod: Mod = {
      unique_name: '/u/umbra',
      name: 'Umbral Vitality',
      mod_set: 'UmbraModSet',
      description: JSON.stringify(['+10 Health', '+440 Health']),
      set_stats: JSON.stringify(['+100 Health']),
      set_num_in_set: 3,
      fusion_limit: 1,
    };
    const { mainDescription } = getModCardDisplayTexts(mod, 0, { umbraSetEquippedCount: 3 });
    expect(mainDescription).toContain('10');
  });
});

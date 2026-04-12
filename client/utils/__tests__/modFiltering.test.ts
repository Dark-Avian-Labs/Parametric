import { describe, it, expect } from 'vitest';

import type { Mod } from '../../types/warframe';
import { filterCompatibleMods, normalizeWeaponIdentityName, WEAPON_CATEGORY_TO_MOD_COMPAT } from '../modFiltering';

describe('normalizeWeaponIdentityName', () => {
  it('strips Kuva, Tenet, and Coda prefixes for augment matching', () => {
    expect(normalizeWeaponIdentityName('Kuva Ogris')).toBe('OGRIS');
    expect(normalizeWeaponIdentityName('Tenet Envoy')).toBe('ENVOY');
    expect(normalizeWeaponIdentityName('Coda Vasto')).toBe('VASTO');
    expect(normalizeWeaponIdentityName('Kuva Tenet Test')).toBe('TEST');
  });
});

describe('Launcher mod compatibility', () => {
  it('maps Launcher category to Sniper mods', () => {
    expect(WEAPON_CATEGORY_TO_MOD_COMPAT.Launcher).toContain('Sniper');
  });

  it('accepts Sniper-category mods on Launchers', () => {
    const sniperMod: Mod = {
      unique_name: '/lotus/upgrades/mods/sniper/test',
      name: 'Sniper Ammo Mutation',
      type: 'PRIMARY',
      compat_name: 'Sniper',
    };
    const launcher = {
      unique_name: '/weapons/launcher/test',
      name: 'Test Launcher',
      product_category: 'Launcher',
    };
    expect(filterCompatibleMods([sniperMod], 'primary', launcher)).toHaveLength(1);
  });

  it('matches weapon-specific mods to Kuva variants', () => {
    const augment: Mod = {
      unique_name: '/test/ogris/augment',
      name: 'Nightwatch Napalm',
      type: 'PRIMARY',
      compat_name: 'Ogris',
    };
    const kuvaOgris = {
      unique_name: '/weapons/kuva/ogris',
      name: 'Kuva Ogris',
      product_category: 'Launcher',
    };
    expect(filterCompatibleMods([augment], 'primary', kuvaOgris)).toHaveLength(1);
  });
});

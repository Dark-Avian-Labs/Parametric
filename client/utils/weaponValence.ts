import type { Weapon } from '../types/warframe';

/** Kuva / Tenet / Coda weapons have a configurable progenitor (Valence) damage bonus. */
export function weaponSupportsValenceBonus(weapon: Weapon): boolean {
  return /^(Kuva|Tenet|Coda)\s/i.test(weapon.name.trim());
}

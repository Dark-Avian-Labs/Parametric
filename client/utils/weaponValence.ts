import type { Weapon } from '../types/warframe';

export function weaponSupportsValenceBonus(weapon: Weapon): boolean {
  return /^(Kuva|Tenet|Coda)\s/i.test(weapon.name.trim());
}

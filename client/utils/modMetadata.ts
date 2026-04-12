import type { Mod } from '../types/warframe';

export function isWeaponExilusMod(mod: Pick<Mod, 'is_utility' | 'unique_name' | 'name'>): boolean {
  const u: unknown = mod.is_utility;
  if (u === 1 || u === true) return true;
  if (typeof u === 'number' && Number.isFinite(u) && Math.trunc(u) === 1) return true;
  if (typeof u === 'string' && (u === '1' || u.toLowerCase() === 'true')) return true;

  const path = (mod.unique_name || '').toLowerCase();
  const nm = (mod.name || '').toLowerCase();
  if (path.includes('convertammo') || path.includes('convert_ammo')) return true;
  if (nm.includes('ammo mutation')) return true;
  return false;
}

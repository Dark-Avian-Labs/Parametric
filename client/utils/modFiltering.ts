import type { Mod, EquipmentType } from '../types/warframe';

// ==============================
// Lockout groups
// ==============================

const VARIANT_PREFIXES = [
  'Primed',
  'Archon',
  'Umbral',
  'Amalgam',
  'Necramech',
  'Enhanced',
  'Link',
  'Galvanized',
  'Spectral',
] as const;

/**
 * Derive the "base name" of a mod by stripping known variant prefixes.
 * E.g. "Primed Flow" → "Flow", "Umbral Vitality" → "Vitality",
 *      "Amalgam Serration" → "Serration"
 */
export function getModBaseName(name: string): string {
  let result = name;
  for (const prefix of VARIANT_PREFIXES) {
    if (result.startsWith(`${prefix} `)) {
      result = result.substring(prefix.length + 1);
      // only strip one prefix
      break;
    }
  }
  return result;
}

/**
 * Compute the lockout key for a mod.
 * Mods with the same lockout key cannot be equipped together.
 * Key = baseName (lowercase) + "|" + type
 *
 * Two mods of the same name (e.g. beginner + normal "Flow") naturally
 * share the same key as well, which is correct — they lock each other out.
 */
export function getModLockoutKey(mod: Mod): string {
  const baseName = getModBaseName(mod.name).toLowerCase();
  const type = (mod.type || '').toLowerCase();
  return `${baseName}|${type}`;
}

/**
 * Check whether a candidate mod is locked out by any mod already in the build.
 */
export function isModLockedOut(candidate: Mod, equippedMods: Mod[]): boolean {
  // Rule 1: exact same mod (same uniqueName) can never be equipped twice
  if (equippedMods.some((m) => m.unique_name === candidate.unique_name)) {
    return true;
  }

  // Rule 2: mods in the same lockout group can't coexist
  const candidateKey = getModLockoutKey(candidate);
  return equippedMods.some((m) => getModLockoutKey(m) === candidateKey);
}

// ==============================
// Mod compatibility filtering
// ==============================

/**
 * The weapon sub-categories that map to specific `compatName` values.
 * When a user is editing a Shotgun, we show mods with:
 *   - compatName matching "Shotgun" (shotgun-specific)
 *   - compatName matching the broad type "PRIMARY" (general primary mods)
 *   - compatName matching the specific weapon name (weapon-unique mods)
 *   - compatName "ANY" (universal mods)
 */

/** Map from weapon productCategory → which mod types + compatNames to show */
const WEAPON_CATEGORY_TO_MOD_COMPAT: Record<string, string[]> = {
  // Primary weapon subcategories
  LongGuns: ['Rifle', 'PRIMARY', 'Assault Rifle'],
  Shotgun: ['Shotgun', 'PRIMARY'],
  Bow: ['Bow', 'PRIMARY'],
  Sniper: ['Sniper', 'PRIMARY'],

  // Secondary
  Pistols: ['Pistol'],
  Thrown: ['Thrown'],

  // Melee (productCategory is "Melee" for all melee)
  Melee: ['Melee'],

  // Space weapons
  SpaceGuns: ['Archgun'],
  SpaceMelee: ['Archmelee'],
};

/**
 * Determine which mods are compatible with the given equipment.
 *
 * @param mods            All available mods
 * @param equipmentType   The broad equipment category (warframe, primary, etc.)
 * @param equipment       The specific equipment item (for weapon-specific compat checks)
 */
export function filterCompatibleMods(
  mods: Mod[],
  equipmentType: EquipmentType,
  equipment?: { unique_name: string; name: string; product_category?: string },
): Mod[] {
  return mods.filter((mod) => isModCompatible(mod, equipmentType, equipment));
}

function isModCompatible(
  mod: Mod,
  equipmentType: EquipmentType,
  equipment?: { unique_name: string; name: string; product_category?: string },
): boolean {
  const modType = (mod.type || '').toUpperCase();
  const compat = (mod.compat_name || '').trim();

  // Universal mods (compatName "ANY") work on everything
  if (compat.toUpperCase() === 'ANY') return true;

  switch (equipmentType) {
    case 'warframe':
      return isWarframeModCompatible(mod, modType, compat, equipment);

    case 'primary':
      return isPrimaryModCompatible(mod, modType, compat, equipment);

    case 'secondary':
      return isSecondaryModCompatible(mod, modType, compat, equipment);

    case 'melee':
      return isMeleeModCompatible(mod, modType, compat, equipment);

    case 'companion':
      return isCompanionModCompatible(mod, modType, compat, equipment);

    case 'archgun':
      return modType === 'ARCH-GUN';

    case 'archmelee':
      return modType === 'ARCH-MELEE';

    case 'archwing':
      return modType === 'ARCHWING';

    case 'necramech':
      return modType === '---' && compat.toLowerCase() === 'necramech';

    case 'kdrive':
      return modType === '---' && compat.toLowerCase() === 'k-drive';

    default:
      return false;
  }
}

function isWarframeModCompatible(
  mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string },
): boolean {
  // Aura mods
  if (modType === 'AURA') return true;

  // General warframe mods
  if (modType === 'WARFRAME' && compat.toUpperCase() === 'WARFRAME')
    return true;

  // Warframe-specific augments (compat matches a warframe name)
  if (modType === 'WARFRAME' && equipment) {
    // Augment mods have compatName set to the warframe's display name
    // e.g. compat="Volt" for Volt augments
    const equipName = equipment.name.replace(/\s+PRIME$/i, '').toUpperCase();
    if (compat.toUpperCase() === equipName) return true;

    // Also check via subtype path matching
    if (mod.subtype && equipment.unique_name) {
      // subtype is like "/Lotus/Powersuits/Nezha/NezhaBaseSuit"
      // equipment.unique_name is like "/Lotus/Powersuits/Nezha/NezhaBaseSuit"
      // Prime variants share the base suit path
      if (
        equipment.unique_name.includes(mod.subtype) ||
        mod.subtype.includes(equipment.unique_name.replace(/Prime/, ''))
      ) {
        return true;
      }
    }
  }

  return false;
}

function isPrimaryModCompatible(
  _mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string; product_category?: string },
): boolean {
  if (modType !== 'PRIMARY') return false;

  const compatUpper = compat.toUpperCase();

  // General primary mods work on all primaries
  if (compatUpper === 'PRIMARY') return true;

  // Determine the weapon's subcategory
  const category = equipment?.product_category || '';

  // Get the compatible mod compat names for this weapon category
  const validCompats = WEAPON_CATEGORY_TO_MOD_COMPAT[category] || [];
  if (validCompats.some((c) => c.toUpperCase() === compatUpper)) return true;

  // Weapon-specific mods (compat matches the weapon name)
  if (equipment) {
    const weaponName = equipment.name.replace(/\s+/g, ' ').toUpperCase();
    if (compatUpper === weaponName) return true;
  }

  // Some compat names are broader: "Rifle (No Aoe)" should still match rifles
  if (compatUpper.startsWith('RIFLE') && category === 'LongGuns') return true;
  if (compatUpper.startsWith('SHOTGUN') && category === 'Shotgun') return true;

  return false;
}

function isSecondaryModCompatible(
  _mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string },
): boolean {
  if (modType !== 'SECONDARY') return false;

  const compatUpper = compat.toUpperCase();

  // General secondary mods
  if (compatUpper === 'PISTOL') return true;
  if (compatUpper === 'SECONDARY') return true;

  // Weapon-specific
  if (equipment) {
    const weaponName = equipment.name.replace(/\s+/g, ' ').toUpperCase();
    if (compatUpper === weaponName) return true;
  }

  // Broader matches
  if (compatUpper.startsWith('PISTOL')) return true;

  return false;
}

function isMeleeModCompatible(
  mod: Mod,
  modType: string,
  compat: string,
  equipment?: { unique_name: string; name: string },
): boolean {
  const compatUpper = compat.toUpperCase();

  // Stance mods (for stance slot)
  if (modType === 'STANCE') {
    // TODO: filter by melee weapon type (Swords, Polearms, etc.)
    // For now, show all stances — the slot type filtering will handle it
    return true;
  }

  if (modType !== 'MELEE') return false;

  // General melee mods
  if (compatUpper === 'MELEE') return true;

  // Melee-subtype specific (Daggers, Claws, Polearms, etc.)
  // These should match if the weapon is of that subtype
  // TODO: need weapon subtype data to filter precisely

  // Weapon-specific
  if (equipment) {
    const weaponName = equipment.name.replace(/\s+/g, ' ').toUpperCase();
    if (compatUpper === weaponName) return true;
  }

  // Show all melee-type mods for now, refine later
  return true;
}

function isCompanionModCompatible(
  _mod: Mod,
  modType: string,
  compat: string,
  _equipment?: { unique_name: string; name: string },
): boolean {
  const compatUpper = compat.toUpperCase();

  // Companion mod types
  if (
    modType === 'SENTINEL' ||
    modType === 'KAVAT' ||
    modType === 'KUBROW' ||
    modType === 'HELMINTH CHARGER'
  ) {
    // General companion mods
    if (
      compatUpper === 'COMPANION' ||
      compatUpper === 'BEAST' ||
      compatUpper === 'ROBOTIC'
    ) {
      return true;
    }

    // Specific companion types
    // Show all companion-type mods for now
    return true;
  }

  return false;
}

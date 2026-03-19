import type { EquipmentType } from '../types/warframe';

const SPECIAL_PRIMARY_NAMES = new Set(['Artemis Bow', 'Artemis Bow Prime', 'Neutralizer']);

const SPECIAL_SECONDARY_NAMES = new Set([
  'Balefire Charger',
  'Balefire Charger Prime',
  'Dex Pixia',
  'Dex Pixia Prime',
  'Glory',
  'Noctua',
  'Regulators',
  'Regulators Prime',
]);

const SPECIAL_MELEE_NAMES = new Set([
  'Desert Wind',
  'Desert Wind Prime',
  'Diwata',
  'Diwata Prime',
  'Exalted Blade',
  'Exalted Prime Blade',
  'Exalted Umbra Blade',
  'Garuda Talons',
  'Garuda Prime Talons',
  'Iron Staff',
  'Iron Staff Prime',
  'Landslide Fists',
  'Landslide Fists Prime',
  'Shadow Claws',
  'Shadow Claws Prime',
  'Shadow Clones',
  'Shadow Clones Prime',
  'Shattered Lash',
  'Shattered Lash Prime',
  'Valkyr Talons',
  'Valkyr Prime Talons',
  'Whipclaw',
  'Whipclaw Prime',
]);

const SPECIAL_NECRAMECH_SELECTION_TYPE: Record<string, EquipmentType> = {
  Arquebex: 'archgun',
  Ironbride: 'archmelee',
};

const REQUIRED_EXALTED_STANCES_BY_EQUIPMENT: Record<string, string> = {
  'desert wind': 'Serene Storm',
  'desert wind prime': 'Serene Storm',
  'exalted blade': 'Exalted Blade',
  'exalted prime blade': 'Exalted Blade',
  'exalted umbra blade': 'Exalted Blade',
  'iron staff': 'Primal Fury',
  'iron staff prime': 'Primal Fury',
  'shadow claws': 'Ravenous Wraith',
  'shadow claws prime': 'Ravenous Wraith',
  'valkyr talons': 'Hysteria',
  'valkyr prime talons': 'Hysteria',
};

export function normalizeEquipmentName(name: string): string {
  return name.replace(/^<[^>]+>\s*/i, '').trim();
}

function normalizeLookupName(name: string): string {
  return normalizeEquipmentName(name).replace(/\s+/g, ' ').toLowerCase();
}

export function getSpecialItemSelectionType(
  name: string,
  equipmentType: EquipmentType,
): EquipmentType | null {
  const normalized = normalizeEquipmentName(name);
  const necramechMappedType = SPECIAL_NECRAMECH_SELECTION_TYPE[normalized];

  if (equipmentType === 'primary' && SPECIAL_PRIMARY_NAMES.has(normalized)) {
    return 'primary';
  }
  if (equipmentType === 'secondary' && SPECIAL_SECONDARY_NAMES.has(normalized)) {
    return 'secondary';
  }
  if (equipmentType === 'melee' && SPECIAL_MELEE_NAMES.has(normalized)) {
    return 'melee';
  }
  if (equipmentType === 'necramech' && necramechMappedType) {
    return necramechMappedType;
  }
  if (
    (equipmentType === 'archgun' || equipmentType === 'archmelee') &&
    necramechMappedType === equipmentType
  ) {
    return equipmentType;
  }

  return null;
}

export function matchesSpecialItemType(name: string, equipmentType: EquipmentType): boolean {
  return getSpecialItemSelectionType(name, equipmentType) !== null;
}

export function getRequiredExaltedStanceName(equipmentName?: string | null): string | null {
  if (!equipmentName) return null;
  const lookupName = normalizeLookupName(equipmentName);
  return REQUIRED_EXALTED_STANCES_BY_EQUIPMENT[lookupName] ?? null;
}

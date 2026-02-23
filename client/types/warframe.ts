// ==============================
// Equipment types
// ==============================

export interface Warframe {
  unique_name: string;
  name: string;
  description?: string;
  health?: number;
  shield?: number;
  armor?: number;
  power?: number;
  sprint_speed?: number;
  passive_description?: string;
  passive_description_wiki?: string;
  product_category?: string;
  // JSON array
  abilities?: string;
  aura_polarity?: string;
  exilus_polarity?: string;
  // JSON array
  polarities?: string;
  mastery_req: number;
  image_path?: string;
  // JSON array of polarity keys from Overframe
  artifact_slots?: string;
}

export interface Weapon {
  unique_name: string;
  name: string;
  description?: string;
  product_category?: string;
  slot?: number;
  mastery_req: number;
  total_damage?: number;
  // JSON array of 20 floats
  damage_per_shot?: string;
  critical_chance?: number;
  critical_multiplier?: number;
  proc_chance?: number;
  fire_rate?: number;
  accuracy?: number;
  magazine_size?: number;
  reload_time?: number;
  multishot?: number;
  noise?: string;
  trigger_type?: string;
  omega_attenuation?: number;
  sentinel?: number;
  // Melee-specific
  blocking_angle?: number;
  combo_duration?: number;
  follow_through?: number;
  range?: number;
  slam_attack?: number;
  heavy_attack_damage?: number;
  wind_up?: number;
  image_path?: string;
  // JSON array of polarity keys from Overframe
  artifact_slots?: string;
  // JSON: weapon fire behavior data from Overframe
  fire_behaviors?: string;
}

export interface Companion {
  unique_name: string;
  name: string;
  description?: string;
  health?: number;
  shield?: number;
  armor?: number;
  power?: number;
  product_category?: string;
  mastery_req: number;
  image_path?: string;
  // JSON array of polarity keys from Overframe
  artifact_slots?: string;
}

// ==============================
// Mod types
// ==============================

export type ModRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';

export interface Mod {
  unique_name: string;
  name: string;
  polarity?: string;
  rarity?: ModRarity;
  type?: string;
  compat_name?: string;
  base_drain?: number;
  fusion_limit?: number;
  is_utility?: number;
  is_augment?: number;
  subtype?: string;
  // JSON array
  description?: string;
  image_path?: string;
  // unique_name of the mod set
  mod_set?: string;
  // how many mods in the set
  set_num_in_set?: number;
  // JSON array of set bonus descriptions per rank
  set_stats?: string;
}

export interface ModLevelStat {
  mod_unique_name: string;
  rank: number;
  // JSON
  stats: string;
}

export interface ModSet {
  unique_name: string;
  num_in_set?: number;
  // JSON array
  stats?: string;
}

// ==============================
// Abilities
// ==============================

export interface Ability {
  unique_name: string;
  name: string;
  description?: string;
  warframe_unique_name?: string;
  is_helminth_extractable?: number;
  image_path?: string;
  // JSON: { energy_cost, strength, duration, range, misc }
  wiki_stats?: string;
  energy_cost?: number;
}

// ==============================
// Build types
// ==============================

export type EquipmentType =
  | 'warframe'
  | 'primary'
  | 'secondary'
  | 'melee'
  | 'archgun'
  | 'archmelee'
  | 'companion'
  | 'archwing'
  | 'necramech'
  | 'kdrive';

export type SlotType = 'general' | 'aura' | 'stance' | 'exilus' | 'posture';

export interface ModSlot {
  index: number;
  type: SlotType;
  polarity?: string;
  mod?: Mod;
  rank?: number;
  // user-chosen number of active set pieces (1..set_num_in_set)
  setRank?: number;
}

export interface BuildConfig {
  id?: string;
  name: string;
  equipment_type: EquipmentType;
  equipment_unique_name: string;
  slots: ModSlot[];
  helminth?: {
    replaced_ability_index: number;
    replacement_ability_unique_name: string;
  };
  arcaneSlots?: {
    arcane?: {
      unique_name: string;
      name: string;
      rarity?: string;
      image_path?: string;
      level_stats?: string;
    };
    rank: number;
  }[];
  shardSlots?: {
    shard_type_id?: string;
    buff_id?: number;
    tauforged: boolean;
  }[];
  orokinReactor?: boolean;
}

/** A build with metadata for display in the overview. */
export interface StoredBuild extends BuildConfig {
  id: string;
  equipment_name: string;
  equipment_image?: string;
  created_at: string;
  updated_at: string;
}

/** Equipment type labels for display */
export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  warframe: 'Warframes',
  primary: 'Primary',
  secondary: 'Secondary',
  melee: 'Melee',
  archgun: 'Arch-Gun',
  archmelee: 'Arch-Melee',
  companion: 'Companion',
  archwing: 'Archwing',
  necramech: 'Necramech',
  kdrive: 'K-Drive',
};

/** Canonical category order for display */
export const EQUIPMENT_TYPE_ORDER: EquipmentType[] = [
  'warframe',
  'primary',
  'secondary',
  'melee',
  'companion',
  'archwing',
  'archgun',
  'archmelee',
  'necramech',
  'kdrive',
];

// ==============================
// Polarity types
// ==============================

export const POLARITIES = {
  AP_ATTACK: 'Madurai',
  AP_DEFENSE: 'Vazarin',
  AP_TACTIC: 'Naramon',
  AP_WARD: 'Unairu',
  AP_POWER: 'Zenurik',
  AP_PRECEPT: 'Penjaga',
  AP_UMBRA: 'Umbra',
  AP_ANY: 'Aura',
} as const;

export type PolarityKey = keyof typeof POLARITIES;

export const AP_ATTACK = 'AP_ATTACK' as const;
export const AP_DEFENSE = 'AP_DEFENSE' as const;
export const AP_TACTIC = 'AP_TACTIC' as const;
export const AP_WARD = 'AP_WARD' as const;
export const AP_POWER = 'AP_POWER' as const;
export const AP_PRECEPT = 'AP_PRECEPT' as const;
export const AP_UMBRA = 'AP_UMBRA' as const;
export const AP_ANY = 'AP_ANY' as const;

export const REGULAR_POLARITIES: readonly string[] = [
  AP_ATTACK,
  AP_DEFENSE,
  AP_TACTIC,
  AP_WARD,
  AP_POWER,
  AP_PRECEPT,
];

// ==============================
// Damage types
// ==============================

export const DAMAGE_TYPES = [
  'Impact',
  'Puncture',
  'Slash',
  'Heat',
  'Cold',
  'Electricity',
  'Toxin',
  'Blast',
  'Radiation',
  'Gas',
  'Magnetic',
  'Viral',
  'Corrosive',
  'Void',
  'Tau',
  'Cinematic',
  'ShieldDrain',
  'HealthDrain',
  'EnergyDrain',
  'True',
] as const;

export type DamageType = (typeof DAMAGE_TYPES)[number];

export const PRIMARY_ELEMENTS = [
  'Heat',
  'Cold',
  'Electricity',
  'Toxin',
] as const;
export type PrimaryElement = (typeof PRIMARY_ELEMENTS)[number];

export const ELEMENT_COMBINATIONS: Record<
  string,
  { a: PrimaryElement; b: PrimaryElement }
> = {
  Blast: { a: 'Heat', b: 'Cold' },
  Corrosive: { a: 'Electricity', b: 'Toxin' },
  Gas: { a: 'Heat', b: 'Toxin' },
  Magnetic: { a: 'Cold', b: 'Electricity' },
  Radiation: { a: 'Electricity', b: 'Heat' },
  Viral: { a: 'Cold', b: 'Toxin' },
};

/**
 * The element combination priority order (HCET).
 * When a weapon has two innate elements, the one appearing earlier
 * in this order goes to slot 9, the other to slot 10.
 */
export const ELEMENT_PRIORITY: PrimaryElement[] = [
  'Heat',
  'Cold',
  'Electricity',
  'Toxin',
];

// ==============================
// Slot configuration per equipment type
// ==============================

export interface EquipmentSlotConfig {
  generalSlots: number;
  hasAura: boolean;
  hasStance: boolean;
  hasExilus: boolean;
  hasPosture: boolean;
  /** Second aura slot (only Jade) */
  hasSecondAura: boolean;
}

export const EQUIPMENT_SLOT_CONFIGS: Record<string, EquipmentSlotConfig> = {
  warframe: {
    generalSlots: 8,
    hasAura: true,
    hasStance: false,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  primary: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  secondary: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  melee: {
    generalSlots: 8,
    hasAura: false,
    hasStance: true,
    hasExilus: true,
    hasPosture: false,
    hasSecondAura: false,
  },
  archgun: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  archmelee: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  companion: {
    generalSlots: 10,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  beast_claws: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: true,
    hasSecondAura: false,
  },
  archwing: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  necramech: {
    generalSlots: 12,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  kdrive: {
    generalSlots: 8,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
  tektolyst: {
    generalSlots: 5,
    hasAura: false,
    hasStance: false,
    hasExilus: false,
    hasPosture: false,
    hasSecondAura: false,
  },
};

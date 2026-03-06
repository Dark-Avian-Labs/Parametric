import { getDb } from './connection.js';

interface ShardType {
  id: string;
  name: string;
  icon_path: string;
  tauforged_icon_path: string;
  sort_order: number;
}

interface ShardBuff {
  shard_type_id: string;
  description: string;
  base_value: number;
  tauforged_value: number;
  value_format: string;
  sort_order: number;
}

const SHARD_TYPES: ShardType[] = [
  {
    id: 'crimson',
    name: 'Crimson',
    icon_path: '/icons/shards/CrimsonArchonShard.png',
    tauforged_icon_path: '/icons/shards/TauforgedCrimsonArchonShard.png',
    sort_order: 1,
  },
  {
    id: 'amber',
    name: 'Amber',
    icon_path: '/icons/shards/AmberArchonShard.png',
    tauforged_icon_path: '/icons/shards/TauforgedAmberArchonShard.png',
    sort_order: 2,
  },
  {
    id: 'azure',
    name: 'Azure',
    icon_path: '/icons/shards/AzureArchonShard.png',
    tauforged_icon_path: '/icons/shards/TauforgedAzureArchonShard.png',
    sort_order: 3,
  },
  {
    id: 'violet',
    name: 'Violet',
    icon_path: '/icons/shards/VioletArchonShard.png',
    tauforged_icon_path: '/icons/shards/TauforgedVioletArchonShard.png',
    sort_order: 4,
  },
  {
    id: 'topaz',
    name: 'Topaz',
    icon_path: '/icons/shards/TopazArchonShard.png',
    tauforged_icon_path: '/icons/shards/TauforgedTopazArchonShard.png',
    sort_order: 5,
  },
  {
    id: 'emerald',
    name: 'Emerald',
    icon_path: '/icons/shards/EmeraldArchonShard.png',
    tauforged_icon_path: '/icons/shards/TauforgedEmeraldArchonShard.png',
    sort_order: 6,
  },
];

const SHARD_BUFFS: ShardBuff[] = [
  {
    shard_type_id: 'crimson',
    description: 'Melee Critical Damage',
    base_value: 25,
    tauforged_value: 37.5,
    value_format: '%',
    sort_order: 1,
  },
  {
    shard_type_id: 'crimson',
    description: 'Primary Status Chance',
    base_value: 25,
    tauforged_value: 37.5,
    value_format: '%',
    sort_order: 2,
  },
  {
    shard_type_id: 'crimson',
    description: 'Secondary Critical Chance',
    base_value: 25,
    tauforged_value: 37.5,
    value_format: '%',
    sort_order: 3,
  },
  {
    shard_type_id: 'crimson',
    description: 'Ability Strength',
    base_value: 10,
    tauforged_value: 15,
    value_format: '%',
    sort_order: 4,
  },
  {
    shard_type_id: 'crimson',
    description: 'Ability Duration',
    base_value: 10,
    tauforged_value: 15,
    value_format: '%',
    sort_order: 5,
  },

  {
    shard_type_id: 'amber',
    description: 'Energy on Spawn',
    base_value: 30,
    tauforged_value: 45,
    value_format: '%',
    sort_order: 1,
  },
  {
    shard_type_id: 'amber',
    description: 'Health Orb Effectiveness',
    base_value: 100,
    tauforged_value: 150,
    value_format: '%',
    sort_order: 2,
  },
  {
    shard_type_id: 'amber',
    description: 'Energy Orb Effectiveness',
    base_value: 50,
    tauforged_value: 75,
    value_format: '%',
    sort_order: 3,
  },
  {
    shard_type_id: 'amber',
    description: 'Casting Speed',
    base_value: 25,
    tauforged_value: 37.5,
    value_format: '%',
    sort_order: 4,
  },
  {
    shard_type_id: 'amber',
    description: 'Parkour Velocity',
    base_value: 15,
    tauforged_value: 22.5,
    value_format: '%',
    sort_order: 5,
  },

  {
    shard_type_id: 'azure',
    description: 'Health',
    base_value: 150,
    tauforged_value: 225,
    value_format: '+flat',
    sort_order: 1,
  },
  {
    shard_type_id: 'azure',
    description: 'Shield',
    base_value: 150,
    tauforged_value: 225,
    value_format: '+flat',
    sort_order: 2,
  },
  {
    shard_type_id: 'azure',
    description: 'Energy',
    base_value: 50,
    tauforged_value: 75,
    value_format: '+flat',
    sort_order: 3,
  },
  {
    shard_type_id: 'azure',
    description: 'Armor',
    base_value: 150,
    tauforged_value: 225,
    value_format: '+flat',
    sort_order: 4,
  },
  {
    shard_type_id: 'azure',
    description: 'Health Regeneration',
    base_value: 5,
    tauforged_value: 7.5,
    value_format: '/s',
    sort_order: 5,
  },

  {
    shard_type_id: 'violet',
    description: 'Health/Energy Orb Conversion',
    base_value: 20,
    tauforged_value: 30,
    value_format: '%',
    sort_order: 1,
  },
  {
    shard_type_id: 'violet',
    description: 'Melee Crit DMG (doubled at 500+ energy)',
    base_value: 25,
    tauforged_value: 37.5,
    value_format: '%',
    sort_order: 2,
  },
  {
    shard_type_id: 'violet',
    description: 'Primary Electricity DMG (+ per shard)',
    base_value: 30,
    tauforged_value: 45,
    value_format: '%',
    sort_order: 3,
  },
  {
    shard_type_id: 'violet',
    description: 'Ability DMG on Electricity Status',
    base_value: 10,
    tauforged_value: 15,
    value_format: '%',
    sort_order: 4,
  },

  {
    shard_type_id: 'topaz',
    description: 'Ability DMG on Radiation Status',
    base_value: 10,
    tauforged_value: 15,
    value_format: '%',
    sort_order: 1,
  },
  {
    shard_type_id: 'topaz',
    description: 'Secondary Crit on Heat Kill',
    base_value: 0,
    tauforged_value: 0,
    value_format: 'proc',
    sort_order: 2,
  },
  {
    shard_type_id: 'topaz',
    description: 'Shield Regen on Blast Kill',
    base_value: 0,
    tauforged_value: 0,
    value_format: 'proc',
    sort_order: 3,
  },
  {
    shard_type_id: 'topaz',
    description: 'Health on Blast Kill',
    base_value: 0,
    tauforged_value: 0,
    value_format: 'proc',
    sort_order: 4,
  },

  {
    shard_type_id: 'emerald',
    description: 'Toxin Status Damage',
    base_value: 30,
    tauforged_value: 45,
    value_format: '%',
    sort_order: 1,
  },
  {
    shard_type_id: 'emerald',
    description: 'Health on Toxin Status',
    base_value: 0,
    tauforged_value: 0,
    value_format: 'proc',
    sort_order: 2,
  },
  {
    shard_type_id: 'emerald',
    description: 'Ability DMG on Corrosion Status',
    base_value: 0,
    tauforged_value: 0,
    value_format: 'proc',
    sort_order: 3,
  },
  {
    shard_type_id: 'emerald',
    description: 'Max Corrosion Stacks',
    base_value: 2,
    tauforged_value: 3,
    value_format: '+flat',
    sort_order: 4,
  },
];

export function seedArchonShards(): void {
  const db = getDb();

  const existing = db
    .prepare('SELECT COUNT(*) as cnt FROM archon_shard_types')
    .get() as { cnt: number };
  if (existing.cnt > 0) {
    console.log('[DB] Archon shard data already seeded, skipping');
    return;
  }

  const insertType = db.prepare(
    'INSERT INTO archon_shard_types (name, icon_path, tauforged_icon_path, sort_order) VALUES (?, ?, ?, ?)',
  );
  const insertBuff = db.prepare(
    'INSERT INTO archon_shard_buffs (shard_type_id, description, base_value, tauforged_value, value_format, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  );

  const seedAll = db.transaction(() => {
    const typeIdMap = new Map<string, number>();
    for (const st of SHARD_TYPES) {
      const result = insertType.run(
        st.name,
        st.icon_path,
        st.tauforged_icon_path,
        st.sort_order,
      );
      typeIdMap.set(
        st.id,
        (result as { lastInsertRowid: number }).lastInsertRowid,
      );
    }
    for (const sb of SHARD_BUFFS) {
      const shardTypeId = typeIdMap.get(sb.shard_type_id);
      if (shardTypeId === undefined) {
        console.warn(
          `[DB] Skipping SHARD_BUFFS entry: shard_type_id "${sb.shard_type_id}" not found in SHARD_TYPES (description: "${sb.description}", sort_order: ${sb.sort_order})`,
        );
        continue;
      }
      insertBuff.run(
        shardTypeId,
        sb.description,
        sb.base_value,
        sb.tauforged_value,
        sb.value_format,
        sb.sort_order,
      );
    }
  });

  seedAll();
  console.log('[DB] Archon shard data seeded successfully');
}

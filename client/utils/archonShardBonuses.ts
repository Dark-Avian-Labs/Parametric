import type { ShardSlotConfig, ShardType } from '../components/ModBuilder/ArchonShardSlots';
import type { WarframeBonusEffects } from './warframeCalc';

export function extractArchonShardBonuses(
  shardSlots?: ShardSlotConfig[],
  shardTypes?: ShardType[],
): WarframeBonusEffects {
  const bonuses: WarframeBonusEffects = {};
  if (!shardSlots?.length || !shardTypes?.length) return bonuses;

  for (const slot of shardSlots) {
    if (!slot?.shard_type_id || slot.buff_id == null) continue;
    const shard = shardTypes.find((s) => String(s.id) === String(slot.shard_type_id));
    if (!shard) continue;
    const buff = shard.buffs.find((b) => String(b.id) === String(slot.buff_id));
    if (!buff) continue;

    const value = slot.tauforged === true ? buff.tauforged_value : buff.base_value;
    const pct = buff.value_format === '%' ? value / 100 : 0;
    const flat = buff.value_format === '%' ? 0 : value;
    const desc = buff.description.toLowerCase();

    if (desc.includes('ability strength')) {
      bonuses.abilityStrengthPct = (bonuses.abilityStrengthPct ?? 0) + pct;
      continue;
    }
    if (desc.includes('ability duration')) {
      bonuses.abilityDurationPct = (bonuses.abilityDurationPct ?? 0) + pct;
      continue;
    }
    if (desc.includes('ability efficiency')) {
      bonuses.abilityEfficiencyPct = (bonuses.abilityEfficiencyPct ?? 0) + pct;
      continue;
    }
    if (desc.includes('ability range')) {
      bonuses.abilityRangePct = (bonuses.abilityRangePct ?? 0) + pct;
      continue;
    }
    if (desc.includes('sprint speed')) {
      bonuses.sprintSpeedPct = (bonuses.sprintSpeedPct ?? 0) + pct;
      bonuses.sprintSpeedFlat = (bonuses.sprintSpeedFlat ?? 0) + flat;
      continue;
    }
    if (desc.includes('armor')) {
      bonuses.armorPct = (bonuses.armorPct ?? 0) + pct;
      bonuses.armorFlat = (bonuses.armorFlat ?? 0) + flat;
      continue;
    }
    if (desc.includes('shield')) {
      bonuses.shieldPct = (bonuses.shieldPct ?? 0) + pct;
      bonuses.shieldFlat = (bonuses.shieldFlat ?? 0) + flat;
      continue;
    }
    if (desc.includes('energy')) {
      bonuses.energyPct = (bonuses.energyPct ?? 0) + pct;
      bonuses.energyFlat = (bonuses.energyFlat ?? 0) + flat;
      continue;
    }
    if (desc.includes('health') && !desc.includes('health orb') && !desc.includes('health regen')) {
      bonuses.healthPct = (bonuses.healthPct ?? 0) + pct;
      bonuses.healthFlat = (bonuses.healthFlat ?? 0) + flat;
    }
  }

  return bonuses;
}

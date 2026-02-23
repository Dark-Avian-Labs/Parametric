import type { ScrapedItemData } from './itemScraper.js';
import { getDb } from '../db/connection.js';

export interface MergeResult {
  warframesUpdated: number;
  weaponsUpdated: number;
  companionsUpdated: number;
  abilitiesUpdated: number;
}

/**
 * Merge scraped data back into the DB by updating existing rows.
 * Matches abilities by unique_name (ability path), not warframe path,
 * so Prime/Umbra variants get the same data as their base.
 */
export function mergeScrapedData(
  items: ScrapedItemData[],
  onProgress?: (msg: string) => void,
): MergeResult {
  const db = getDb();
  const result: MergeResult = {
    warframesUpdated: 0,
    weaponsUpdated: 0,
    companionsUpdated: 0,
    abilitiesUpdated: 0,
  };

  const updateWarframe = db.prepare(
    'UPDATE warframes SET artifact_slots = ? WHERE unique_name = ?',
  );
  const updateWeapon = db.prepare(
    'UPDATE weapons SET artifact_slots = ?, fire_behaviors = ? WHERE unique_name = ?',
  );
  const updateCompanion = db.prepare(
    'UPDATE companions SET artifact_slots = ? WHERE unique_name = ?',
  );
  const updateAbility = db.prepare(
    'UPDATE abilities SET ability_stats = ? WHERE unique_name = ?',
  );

  const findTable = db.prepare(
    `SELECT 'warframes' AS tbl FROM warframes WHERE unique_name = ?
     UNION ALL
     SELECT 'weapons' FROM weapons WHERE unique_name = ?
     UNION ALL
     SELECT 'companions' FROM companions WHERE unique_name = ?`,
  );

  const mergeAll = db.transaction(() => {
    for (const item of items) {
      const uniqueName = item.entry.dbUniqueName;
      if (!uniqueName) continue;

      const rows = findTable.all(uniqueName, uniqueName, uniqueName) as {
        tbl: string;
      }[];
      const table = rows[0]?.tbl;

      if (!table) {
        onProgress?.(
          `No DB row found for ${item.entry.name} (${uniqueName}), skipping`,
        );
        continue;
      }

      // Always store a JSON string for successfully scraped items:
      // "[]" for items with no slot data, so they're not re-scraped next startup
      const artifactSlotsJson = JSON.stringify(item.artifactSlots);

      if (table === 'warframes') {
        updateWarframe.run(artifactSlotsJson, uniqueName);
        result.warframesUpdated++;
      } else if (table === 'weapons') {
        const fireBehaviorsJson = JSON.stringify(item.fireBehaviors);
        updateWeapon.run(artifactSlotsJson, fireBehaviorsJson, uniqueName);
        result.weaponsUpdated++;
      } else if (table === 'companions') {
        updateCompanion.run(artifactSlotsJson, uniqueName);
        result.companionsUpdated++;
      }

      // Merge ability stats by matching ability unique_name (path)
      if (item.abilities.length > 0 && item.itemData) {
        const abilityTypes = (item.itemData as Record<string, unknown>)
          .AbilityTypes as { path: string; LocalizeTag: string }[] | undefined;

        if (abilityTypes) {
          for (let i = 0; i < abilityTypes.length; i++) {
            const abilityPath = abilityTypes[i].path;
            const scrapedAbility = item.abilities[i];
            if (!abilityPath || !scrapedAbility) continue;

            const statsJson =
              scrapedAbility.stats.length > 0
                ? JSON.stringify(scrapedAbility.stats)
                : null;

            if (statsJson) {
              const changes = updateAbility.run(statsJson, abilityPath);
              if (changes.changes > 0) result.abilitiesUpdated++;
            }
          }
        }
      }

      onProgress?.(`Merged ${item.entry.name} (${table})`);
    }
  });

  mergeAll();
  return result;
}

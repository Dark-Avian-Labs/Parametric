import { isCapacitySlot } from './drain';
import {
  AP_ANY,
  AP_UMBRA,
  REGULAR_POLARITIES,
  type SlotType,
} from '../types/warframe';

export interface FormaCount {
  regular: number;
  universal: number;
  umbra: number;
  stance: number;
  total: number;
}

export interface SlotPolarity {
  polarity: string | undefined;
  type: SlotType;
}

function countMultiset(
  polarities: (string | undefined)[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of polarities) {
    if (p) {
      counts.set(p, (counts.get(p) || 0) + 1);
    }
  }
  return counts;
}

export function calculateFormaCount(
  defaults: SlotPolarity[],
  desired: SlotPolarity[],
): FormaCount {
  const defaultPolarities = defaults.map((s) => s.polarity);
  const desiredPolarities = desired.map((s) => s.polarity);

  const defaultCounts = countMultiset(defaultPolarities);
  const desiredCounts = countMultiset(desiredPolarities);

  let totalReused = 0;
  const allKeys = new Set([...defaultCounts.keys(), ...desiredCounts.keys()]);

  for (const key of allKeys) {
    const def = defaultCounts.get(key) || 0;
    const des = desiredCounts.get(key) || 0;
    totalReused += Math.min(def, des);
  }

  let totalDefaults = 0;
  for (const v of defaultCounts.values()) totalDefaults += v;

  const unmatchedDefaults = totalDefaults - totalReused;

  let unmatchedRegular = 0;
  for (const pol of REGULAR_POLARITIES) {
    const def = defaultCounts.get(pol) || 0;
    const des = desiredCounts.get(pol) || 0;
    unmatchedRegular += Math.max(0, des - def);
  }

  const unmatchedUmbra = Math.max(
    0,
    (desiredCounts.get(AP_UMBRA) || 0) - (defaultCounts.get(AP_UMBRA) || 0),
  );

  const totalNewUniversal = Math.max(
    0,
    (desiredCounts.get(AP_ANY) || 0) - (defaultCounts.get(AP_ANY) || 0),
  );

  let defaultUniversalCapacity = 0;
  for (const s of defaults) {
    if (s.polarity === AP_ANY && isCapacitySlot(s.type)) {
      defaultUniversalCapacity++;
    }
  }

  let desiredUniversalCapacity = 0;
  for (const s of desired) {
    if (s.polarity === AP_ANY && isCapacitySlot(s.type)) {
      desiredUniversalCapacity++;
    }
  }

  const newStance = Math.max(
    0,
    desiredUniversalCapacity - defaultUniversalCapacity,
  );
  const newUniversal = Math.max(0, totalNewUniversal - newStance);

  const excessClears = Math.max(
    0,
    unmatchedDefaults - unmatchedRegular - totalNewUniversal - unmatchedUmbra,
  );

  const regular = unmatchedRegular + excessClears;

  return {
    regular,
    universal: newUniversal,
    umbra: unmatchedUmbra,
    stance: newStance,
    total: regular + newUniversal + unmatchedUmbra + newStance,
  };
}

import {
  PRIMARY_ELEMENTS,
  ELEMENT_COMBINATIONS,
  ELEMENT_PRIORITY,
  DAMAGE_TYPES,
  type PrimaryElement,
  type DamageType,
} from '../types/warframe';

/**
 * Represents a damage entry in the output.
 */
export interface DamageEntry {
  type: DamageType;
  value: number;
}

/**
 * An element added by a mod in a specific slot.
 */
interface ElementMod {
  // 0-7 in the 4x2 grid
  slotIndex: number;
  element: PrimaryElement;
  value: number;
}

/**
 * Calculate the final damage output for a weapon with mods.
 *
 * Slot order is 4x2 grid:
 *   1 2 3 4
 *   5 6 7 8
 *
 * Element combination rules:
 * - Adjacent primary elements (by slot order) combine into secondary elements.
 * - Innate weapon elements are applied last (as slot 9, or 9+10 for dual-innate).
 * - If a mod's element matches an innate element, they merge into that mod's slot.
 * - Pre-existing secondary elements on a weapon are independent unless the user
 *   also creates the same combined element through mods.
 *
 * @param baseDamage      The weapon's base damagePerShot array (20 floats)
 * @param elementMods     Elements added by mods, with slot positions
 * @param damageMultipliers  Optional multipliers for each damage type
 */
export function calculateFinalDamage(
  baseDamage: number[],
  elementMods: ElementMod[],
  damageMultipliers: Partial<Record<DamageType, number>> = {},
): DamageEntry[] {
  // Start with base physical damage (indices 0-2)
  const output: Map<DamageType, number> = new Map();

  // Apply base damage values
  for (let i = 0; i < DAMAGE_TYPES.length; i++) {
    const val = baseDamage[i] || 0;
    if (val > 0) {
      output.set(DAMAGE_TYPES[i], val);
    }
  }

  // Apply multipliers to base damage
  for (const [type, mult] of Object.entries(damageMultipliers)) {
    const current = output.get(type as DamageType) || 0;
    if (current > 0) {
      output.set(type as DamageType, current * (1 + mult));
    }
  }

  // Identify innate elements from the weapon (indices 3-12 for elements)
  const innateElements = identifyInnateElements(baseDamage);

  // Sort mods by slot index (they should already be, but ensure it)
  const sortedMods = [...elementMods].sort((a, b) => a.slotIndex - b.slotIndex);

  // Build the element sequence: mods first, then innate elements
  const elementSequence = buildElementSequence(sortedMods, innateElements);

  // Combine elements in sequence
  const combinedElements = combineElements(elementSequence);

  // Merge combined elements into output
  // Remove innate primary elements that were consumed by combination
  for (const combined of combinedElements) {
    const existing = output.get(combined.type) || 0;
    output.set(combined.type, existing + combined.value);
  }

  // Remove zero entries and return
  const result: DamageEntry[] = [];
  for (const [type, value] of output) {
    if (value > 0) {
      result.push({ type, value: Math.round(value * 10) / 10 });
    }
  }

  return result;
}

/**
 * Identify innate primary elements from a weapon's base damage array.
 * Returns elements with their index in the ELEMENT_PRIORITY order.
 */
function identifyInnateElements(
  baseDamage: number[],
): Array<{ element: PrimaryElement; value: number }> {
  const result: Array<{ element: PrimaryElement; value: number }> = [];

  // Primary elements are at indices 3-6 (Heat, Cold, Electricity, Toxin)
  for (let i = 0; i < PRIMARY_ELEMENTS.length; i++) {
    const value = baseDamage[3 + i] || 0;
    if (value > 0) {
      result.push({ element: PRIMARY_ELEMENTS[i], value });
    }
  }

  // Sort by ELEMENT_PRIORITY order (HCET)
  result.sort((a, b) => {
    return (
      ELEMENT_PRIORITY.indexOf(a.element) - ELEMENT_PRIORITY.indexOf(b.element)
    );
  });

  return result;
}

interface ElementEntry {
  element: PrimaryElement;
  value: number;
  isInnate: boolean;
}

/**
 * Build the full element sequence: mod elements in slot order,
 * then innate elements appended.
 *
 * Special case: if a mod element matches an innate element,
 * the innate damage is added to that mod's slot instead of being appended.
 */
function buildElementSequence(
  mods: ElementMod[],
  innate: Array<{ element: PrimaryElement; value: number }>,
): ElementEntry[] {
  const sequence: ElementEntry[] = [];
  const consumedInnate = new Set<PrimaryElement>();

  // Add mod elements
  for (const mod of mods) {
    let value = mod.value;

    // Check if this mod element matches an innate element
    const innateMatch = innate.find(
      (ie) => ie.element === mod.element && !consumedInnate.has(ie.element),
    );
    if (innateMatch) {
      value += innateMatch.value;
      consumedInnate.add(mod.element);
    }

    sequence.push({
      element: mod.element,
      value,
      isInnate: false,
    });
  }

  // Append remaining innate elements (not consumed by matching mods)
  for (const ie of innate) {
    if (!consumedInnate.has(ie.element)) {
      sequence.push({
        element: ie.element,
        value: ie.value,
        isInnate: true,
      });
    }
  }

  return sequence;
}

/**
 * Combine adjacent primary elements in the sequence into secondary elements.
 *
 * Two adjacent primary elements combine if:
 * 1. They are directly adjacent (no gap with another element between them)
 * 2. They form a valid combination
 *
 * Once two elements combine, the resulting secondary element occupies that
 * position and cannot combine further.
 */
function combineElements(sequence: ElementEntry[]): DamageEntry[] {
  if (sequence.length === 0) return [];

  const result: DamageEntry[] = [];
  let i = 0;

  while (i < sequence.length) {
    const current = sequence[i];

    // Check if next element can combine with this one
    if (i + 1 < sequence.length) {
      const next = sequence[i + 1];
      const combined = findCombination(current.element, next.element);

      if (combined) {
        result.push({
          type: combined as DamageType,
          value: current.value + next.value,
        });
        // Skip both elements
        i += 2;
        continue;
      }
    }

    // No combination — add as primary element
    result.push({
      type: current.element as DamageType,
      value: current.value,
    });
    i++;
  }

  return result;
}

/**
 * Find the secondary element produced by combining two primary elements.
 */
function findCombination(a: PrimaryElement, b: PrimaryElement): string | null {
  for (const [result, { a: ea, b: eb }] of Object.entries(
    ELEMENT_COMBINATIONS,
  )) {
    if ((a === ea && b === eb) || (a === eb && b === ea)) {
      return result;
    }
  }
  return null;
}

/**
 * Get element color for display.
 */
export function getElementColor(element: string): string {
  const colors: Record<string, string> = {
    Impact: '#8899aa',
    Puncture: '#aabbcc',
    Slash: '#cc8866',
    Heat: '#ff6633',
    Cold: '#66ccff',
    Electricity: '#cccc00',
    Toxin: '#33cc33',
    Blast: '#ff9933',
    Radiation: '#cccc66',
    Gas: '#66cc99',
    Magnetic: '#6699cc',
    Viral: '#66cccc',
    Corrosive: '#cccc33',
    Void: '#cc99ff',
    True: '#ffffff',
  };
  return colors[element] || '#999999';
}

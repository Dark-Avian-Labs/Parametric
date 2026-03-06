import fs from 'fs';
import path from 'path';

import { PROJECT_ROOT } from '../config.js';
import { closeAll, getDb } from '../db/connection.js';
import { getCorpusDb } from '../db/corpus.js';

type WeaponClass = 'primary' | 'secondary' | 'melee';

interface WeaponRow {
  unique_name: string;
  name: string;
  product_category: string | null;
  total_damage: number | null;
  critical_chance: number | null;
  critical_multiplier: number | null;
  proc_chance: number | null;
  fire_rate: number | null;
  magazine_size: number | null;
  reload_time: number | null;
  multishot: number | null;
  range: number | null;
  fire_behaviors: string | null;
}

interface ModRow {
  unique_name: string;
  name: string;
  type: string | null;
  compat_name: string | null;
  description: string | null;
  fusion_limit: number | null;
  is_augment: number | null;
}

interface StatEffects {
  baseDamage: number;
  multishot: number;
  critChance: number;
  critMultiplier: number;
  fireRate: number;
  magazineCapacity: number;
  reloadSpeed: number;
  statusChance: number;
  statusDuration: number;
  impactDamage: number;
  punctureDamage: number;
  slashDamage: number;
  factionDamage: number;
  toxinDamage: number;
  heatDamage: number;
  coldDamage: number;
  electricityDamage: number;
}

interface DpsResult {
  burstDps: number;
  sustainedDps: number;
}

interface ModDelta {
  mod: ModRow;
  effects: StatEffects;
  families: string[];
  burstDeltaPct: number;
  sustainedDeltaPct: number;
}

interface WeaponAnalysis {
  weapon: WeaponRow;
  weaponClass: WeaponClass;
  baseline: DpsResult;
  modDeltas: ModDelta[];
  bestByFamilyBurst: Map<string, ModDelta>;
  bestByFamilySustained: Map<string, ModDelta>;
  topBurst?: ModDelta;
  topSustained?: ModDelta;
  topBurstFamily?: string;
  topSustainedFamily?: string;
  burstBuild: BuildResult;
  sustainedBuild: BuildResult;
}

interface BuildPick {
  slot: number;
  mod: ModRow;
  family: string;
  gainPct: number;
}

interface BuildResult {
  picks: BuildPick[];
}

const WEAPON_JUNK_PREFIXES = [
  '/Lotus/Types/Friendly/Pets/CreaturePets/',
  '/Lotus/Types/Friendly/Pets/MoaPets/MoaPetParts/',
  '/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/',
  '/Lotus/Types/Items/Deimos/',
  '/Lotus/Types/Vehicles/Hoverboard/',
] as const;

const MOD_JUNK_SEGMENTS = ['/Beginner/', '/Intermediate/', '/Nemesis/'] as const;
const MOD_JUNK_SUFFIXES = ['SubMod'] as const;
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

const WEAPON_CATEGORY_TO_MOD_COMPAT: Record<string, string[]> = {
  LongGuns: ['Rifle', 'PRIMARY', 'Assault Rifle'],
  Shotgun: ['Shotgun', 'PRIMARY'],
  Bow: ['Bow', 'PRIMARY'],
  Sniper: ['Sniper', 'PRIMARY'],
  Pistols: ['Pistol'],
  Thrown: ['Thrown'],
  Melee: ['Melee'],
};

const STAT_PATTERNS: Array<{ regex: RegExp; key: keyof StatEffects }> = [
  { regex: /([+-][\d.]+)%\s+Damage(?!\s+to)(?:\s|$)/i, key: 'baseDamage' },
  { regex: /([+-][\d.]+)%\s+Melee Damage/i, key: 'baseDamage' },
  { regex: /([+-][\d.]+)%\s+Multishot/i, key: 'multishot' },
  { regex: /([+-][\d.]+)%\s+Critical Chance/i, key: 'critChance' },
  { regex: /([+-][\d.]+)%\s+Critical Damage/i, key: 'critMultiplier' },
  { regex: /([+-][\d.]+)%\s+Fire Rate/i, key: 'fireRate' },
  { regex: /([+-][\d.]+)%\s+Attack Speed/i, key: 'fireRate' },
  { regex: /([+-][\d.]+)%\s+Magazine Capacity/i, key: 'magazineCapacity' },
  { regex: /([+-][\d.]+)%\s+Reload Speed/i, key: 'reloadSpeed' },
  { regex: /([+-][\d.]+)%\s+Status Chance/i, key: 'statusChance' },
  { regex: /([+-][\d.]+)%\s+Status Duration/i, key: 'statusDuration' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Impact/i, key: 'impactDamage' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Puncture/i, key: 'punctureDamage' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Slash/i, key: 'slashDamage' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Heat/i, key: 'heatDamage' },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Cold/i, key: 'coldDamage' },
  {
    regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Electricity/i,
    key: 'electricityDamage',
  },
  { regex: /([+-][\d.]+)%\s+(?:<[^>]+>)?Toxin/i, key: 'toxinDamage' },
  { regex: /([+-][\d.]+)%\s+Damage to \w+/i, key: 'factionDamage' },
];

const FAMILY_TO_KEYS: Record<string, Array<keyof StatEffects>> = {
  'Base Damage': ['baseDamage'],
  Multishot: ['multishot'],
  'Critical Chance': ['critChance'],
  'Critical Damage': ['critMultiplier'],
  'Fire Rate / Attack Speed': ['fireRate'],
  'Reload Speed': ['reloadSpeed'],
  'Magazine Capacity': ['magazineCapacity'],
  'Status Chance': ['statusChance'],
  'Status Duration': ['statusDuration'],
  'IPS Damage': ['impactDamage', 'punctureDamage', 'slashDamage'],
  'Elemental Damage': ['heatDamage', 'coldDamage', 'electricityDamage', 'toxinDamage'],
  'Faction Damage': ['factionDamage'],
};

function emptyEffects(): StatEffects {
  return {
    baseDamage: 0,
    multishot: 0,
    critChance: 0,
    critMultiplier: 0,
    fireRate: 0,
    magazineCapacity: 0,
    reloadSpeed: 0,
    statusChance: 0,
    statusDuration: 0,
    impactDamage: 0,
    punctureDamage: 0,
    slashDamage: 0,
    factionDamage: 0,
    toxinDamage: 0,
    heatDamage: 0,
    coldDamage: 0,
    electricityDamage: 0,
  };
}

function getWeaponClass(category: string | null): WeaponClass | null {
  if (category === 'LongGuns') return 'primary';
  if (category === 'Pistols') return 'secondary';
  if (category === 'Melee') return 'melee';
  return null;
}

function parseAmmoCost(weapon: WeaponRow): number {
  if (!weapon.fire_behaviors) return 1;
  try {
    const behaviors = JSON.parse(weapon.fire_behaviors) as Array<{
      ammoRequirement?: number;
    }>;
    if (Array.isArray(behaviors) && behaviors.length > 0) {
      return behaviors[0].ammoRequirement ?? 1;
    }
  } catch {
    // ignore parse issues and use default
  }
  return 1;
}

function calculateWeaponDps(
  weapon: WeaponRow,
  effects: StatEffects,
  weaponClass: WeaponClass,
): DpsResult {
  const isMelee = weaponClass === 'melee';
  const baseTotalDamage = weapon.total_damage ?? 0;
  const baseCritChance = weapon.critical_chance ?? 0;
  const baseCritMultiplier = weapon.critical_multiplier ?? 1;
  const baseFireRate = weapon.fire_rate ?? 1;
  const baseMultishot = weapon.multishot ?? 1;
  const baseMagazine = weapon.magazine_size ?? 1;
  const baseReload = weapon.reload_time ?? 0;

  const moddedTotalDamage = baseTotalDamage * (1 + effects.baseDamage);
  const moddedCritChance = baseCritChance * (1 + effects.critChance);
  const moddedCritMultiplier = baseCritMultiplier * (1 + effects.critMultiplier);
  const moddedFireRate = baseFireRate * (1 + effects.fireRate);
  const moddedMultishot = baseMultishot * (1 + effects.multishot);
  const moddedMagazine = Math.ceil(baseMagazine * (1 + effects.magazineCapacity));
  const reloadDivisor = 1 + effects.reloadSpeed;
  const moddedReloadTime =
    reloadDivisor > 0 ? baseReload / reloadDivisor : baseReload;

  const avgCritMultiplier =
    1 + moddedCritChance * (Math.max(moddedCritMultiplier, 0) - 1);
  const averageHit = isMelee
    ? moddedTotalDamage * avgCritMultiplier
    : moddedTotalDamage * moddedMultishot * avgCritMultiplier;
  const burstDps = averageHit * Math.max(moddedFireRate, 0);

  if (isMelee) {
    return {
      burstDps: Math.max(burstDps, 0),
      sustainedDps: Math.max(burstDps, 0),
    };
  }

  const ammoCost = Math.max(parseAmmoCost(weapon), 1);
  const shotsPerMag = Math.floor(moddedMagazine / ammoCost);
  const sustainedDps =
    shotsPerMag > 0 && moddedReloadTime > 0 && moddedFireRate > 0
      ? burstDps *
        ((shotsPerMag / moddedFireRate) /
          (shotsPerMag / moddedFireRate + moddedReloadTime))
      : burstDps;

  return {
    burstDps: Math.max(burstDps, 0),
    sustainedDps: Math.max(sustainedDps, 0),
  };
}

function pctDelta(modified: number, baseline: number): number {
  if (baseline <= 0) return modified > 0 ? 100 : 0;
  return ((modified - baseline) / baseline) * 100;
}

function parseModEffects(mod: ModRow): StatEffects {
  const effects = emptyEffects();
  if (!mod.description) return effects;

  let descriptions: string[];
  try {
    descriptions = JSON.parse(mod.description) as string[];
  } catch {
    return effects;
  }
  if (!Array.isArray(descriptions) || descriptions.length === 0) return effects;

  const maxRank = mod.fusion_limit ?? descriptions.length - 1;
  const rank = Math.min(Math.max(maxRank, 0), descriptions.length - 1);
  const text = descriptions[rank] ?? descriptions[descriptions.length - 1] ?? '';
  const lines = text.split('\n');
  for (const line of lines) {
    for (const { regex, key } of STAT_PATTERNS) {
      const match = line.match(regex);
      if (match) {
        effects[key] += parseFloat(match[1]) / 100;
        break;
      }
    }
  }
  return effects;
}

function getFamiliesForEffects(effects: StatEffects): string[] {
  const families: string[] = [];
  for (const [family, keys] of Object.entries(FAMILY_TO_KEYS)) {
    if (keys.some((key) => Math.abs(effects[key]) > 0.000001)) {
      families.push(family);
    }
  }
  return families;
}

function getPrimaryFamilyForEffects(effects: StatEffects): string {
  let topFamily = 'Utility';
  let topScore = 0;
  for (const [family, keys] of Object.entries(FAMILY_TO_KEYS)) {
    const score = keys.reduce((sum, key) => sum + Math.max(effects[key], 0), 0);
    if (score > topScore) {
      topScore = score;
      topFamily = family;
    }
  }
  return topFamily;
}

function addEffects(a: StatEffects, b: StatEffects): StatEffects {
  const out = emptyEffects();
  for (const key of Object.keys(out) as Array<keyof StatEffects>) {
    out[key] = a[key] + b[key];
  }
  return out;
}

function getModBaseName(name: string): string {
  let result = name;
  for (const prefix of VARIANT_PREFIXES) {
    if (result.startsWith(`${prefix} `)) {
      result = result.substring(prefix.length + 1);
      break;
    }
  }
  return result;
}

function getModLockoutKey(mod: ModRow): string {
  return `${getModBaseName(mod.name).toLowerCase()}|${(mod.type || '').toLowerCase()}`;
}

function isPrimaryCompatible(mod: ModRow, weapon: WeaponRow): boolean {
  const modType = (mod.type || '').toUpperCase();
  const compat = (mod.compat_name || '').trim().toUpperCase();
  if (modType !== 'PRIMARY') return false;
  if (compat === 'ANY' || compat === 'PRIMARY') return true;

  const category = weapon.product_category || '';
  const validCompats = WEAPON_CATEGORY_TO_MOD_COMPAT[category] || [];
  if (validCompats.some((c) => c.toUpperCase() === compat)) return true;

  const weaponName = weapon.name.replace(/\s+/g, ' ').toUpperCase();
  if (compat === weaponName) return true;
  if (compat.startsWith('RIFLE') && category === 'LongGuns') return true;
  if (compat.startsWith('SHOTGUN') && category === 'Shotgun') return true;
  return false;
}

function isSecondaryCompatible(mod: ModRow, weapon: WeaponRow): boolean {
  const modType = (mod.type || '').toUpperCase();
  const compat = (mod.compat_name || '').trim().toUpperCase();
  if (modType !== 'SECONDARY') return false;
  if (compat === 'ANY' || compat === 'PISTOL' || compat === 'SECONDARY')
    return true;

  const weaponName = weapon.name.replace(/\s+/g, ' ').toUpperCase();
  if (compat === weaponName) return true;
  if (compat.startsWith('PISTOL')) return true;
  return false;
}

function isMeleeCompatible(mod: ModRow, weapon: WeaponRow): boolean {
  const modType = (mod.type || '').toUpperCase();
  const compat = (mod.compat_name || '').trim().toUpperCase();
  if (modType === 'STANCE') return false;
  if (modType !== 'MELEE') return false;
  if (compat === 'ANY' || compat === 'MELEE') return true;

  const weaponName = weapon.name.replace(/\s+/g, ' ').toUpperCase();
  if (compat === weaponName) return true;
  return true;
}

function isCompatible(mod: ModRow, weapon: WeaponRow, weaponClass: WeaponClass): boolean {
  if ((mod.compat_name || '').trim().toUpperCase() === 'ANY') return true;
  if (weaponClass === 'primary') return isPrimaryCompatible(mod, weapon);
  if (weaponClass === 'secondary') return isSecondaryCompatible(mod, weapon);
  return isMeleeCompatible(mod, weapon);
}

function dedupeAndCleanMods(mods: ModRow[]): ModRow[] {
  const cleaned = mods.filter((mod) => {
    if (MOD_JUNK_SEGMENTS.some((seg) => mod.unique_name.includes(seg)))
      return false;
    if (MOD_JUNK_SUFFIXES.some((suf) => mod.unique_name.endsWith(suf)))
      return false;
    if (mod.is_augment === 1) return false;
    if ((mod.name || '').toLowerCase().includes('riven')) return false;
    if (mod.unique_name.toLowerCase().includes('riven')) return false;
    if ((mod.name || '').startsWith('Spectral ')) return false;
    if (mod.unique_name.includes('InvisibleMod')) return false;
    if (
      mod.unique_name.includes('/Sentinel/') ||
      mod.unique_name.includes('/Kubrow/') ||
      mod.unique_name.includes('/Kavat/') ||
      mod.unique_name.includes('/Helminth')
    ) {
      return false;
    }
    if (!isGeneralPurposeMod(mod)) return false;
    return true;
  });

  const byKey = new Map<string, ModRow>();
  for (const mod of cleaned) {
    const key = `${mod.name}|||${mod.type || ''}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, mod);
      continue;
    }
    const existingIsExpert = existing.unique_name.includes('/Expert/');
    const currentIsExpert = mod.unique_name.includes('/Expert/');
    if (existingIsExpert && !currentIsExpert) {
      byKey.set(key, mod);
    }
  }
  return Array.from(byKey.values());
}

function isGeneralPurposeMod(mod: ModRow): boolean {
  const modType = (mod.type || '').toUpperCase();
  const compat = (mod.compat_name || '').trim().toUpperCase();
  if (compat === '' || compat === 'ANY') return true;

  if (modType === 'PRIMARY') {
    return (
      compat === 'PRIMARY' ||
      compat === 'RIFLE' ||
      compat === 'SHOTGUN' ||
      compat === 'BOW' ||
      compat === 'SNIPER' ||
      compat === 'ASSAULT RIFLE' ||
      compat.startsWith('RIFLE') ||
      compat.startsWith('SHOTGUN')
    );
  }
  if (modType === 'SECONDARY') {
    return (
      compat === 'SECONDARY' ||
      compat === 'PISTOL' ||
      compat === 'THROWN' ||
      compat.startsWith('PISTOL')
    );
  }
  if (modType === 'MELEE') {
    return compat === 'MELEE';
  }
  return false;
}

function getModularWeaponSet(): Set<string> {
  const modularSet = new Set<string>();
  try {
    const corpusDb = getCorpusDb();
    const rows = corpusDb
      .prepare(
        `SELECT unique_name FROM corpus_weapons WHERE product_category IN ('LongGuns','Pistols','Melee') AND lower(raw_json) LIKE '%modular%'`,
      )
      .all() as Array<{ unique_name: string }>;
    for (const row of rows) modularSet.add(row.unique_name);
  } catch {
    // corpus DB may be unavailable; fallback heuristics will still apply
  }
  return modularSet;
}

function isLikelyModularWeapon(weapon: WeaponRow, modularSet: Set<string>): boolean {
  if (modularSet.has(weapon.unique_name)) return true;
  const name = weapon.name.toLowerCase();
  const unique = weapon.unique_name.toLowerCase();
  return (
    name.includes('kitgun') ||
    name.includes('zaw') ||
    name.includes('brace') ||
    name.includes('prism') ||
    name.includes('scaffold') ||
    name.includes('strike') ||
    name.includes('grip') ||
    name.includes('chamber') ||
    unique.includes('/kitgun') ||
    unique.includes('/zaw') ||
    unique.includes('/operator') ||
    unique.includes('/amp')
  );
}

function pickBestByFamily(
  deltas: ModDelta[],
  metric: 'burstDeltaPct' | 'sustainedDeltaPct',
): Map<string, ModDelta> {
  const result = new Map<string, ModDelta>();
  for (const delta of deltas) {
    for (const family of delta.families) {
      const current = result.get(family);
      if (!current || delta[metric] > current[metric]) {
        result.set(family, delta);
      }
    }
  }
  return result;
}

function topFamilyFromMap(
  map: Map<string, ModDelta>,
  metric: 'burstDeltaPct' | 'sustainedDeltaPct',
): string | undefined {
  let top: { family: string; value: number } | undefined;
  for (const [family, delta] of map.entries()) {
    const value = delta[metric];
    if (!top || value > top.value) {
      top = { family, value };
    }
  }
  return top?.family;
}

function buildGreedy(
  weapon: WeaponRow,
  weaponClass: WeaponClass,
  compatibleMods: ModRow[],
  effectsByMod: Map<string, StatEffects>,
  metric: 'burstDps' | 'sustainedDps',
  slots = 8,
): BuildResult {
  const picks: BuildPick[] = [];
  let currentEffects = emptyEffects();
  let currentDps = calculateWeaponDps(weapon, currentEffects, weaponClass)[metric];
  const selectedUnique = new Set<string>();
  const selectedLockout = new Set<string>();

  for (let slot = 1; slot <= slots; slot++) {
    let best:
      | {
          mod: ModRow;
          effects: StatEffects;
          gainPct: number;
        }
      | undefined;

    for (const mod of compatibleMods) {
      if (selectedUnique.has(mod.unique_name)) continue;
      const lockout = getModLockoutKey(mod);
      if (selectedLockout.has(lockout)) continue;

      const modEffects = effectsByMod.get(mod.unique_name);
      if (!modEffects) continue;
      const nextEffects = addEffects(currentEffects, modEffects);
      const nextDps = calculateWeaponDps(weapon, nextEffects, weaponClass)[metric];
      const gainPct = pctDelta(nextDps, currentDps);
      if (!best || gainPct > best.gainPct) {
        best = { mod, effects: modEffects, gainPct };
      }
    }

    if (!best || best.gainPct <= 0) break;

    picks.push({
      slot,
      mod: best.mod,
      family: getPrimaryFamilyForEffects(best.effects),
      gainPct: best.gainPct,
    });
    currentEffects = addEffects(currentEffects, best.effects);
    currentDps = calculateWeaponDps(weapon, currentEffects, weaponClass)[metric];
    selectedUnique.add(best.mod.unique_name);
    selectedLockout.add(getModLockoutKey(best.mod));
  }

  return { picks };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function fmtNum(value: number): string {
  return value.toFixed(3);
}

function runStudy(): void {
  const db = getDb();
  const modularSet = getModularWeaponSet();

  const weapons = db
    .prepare(
      `SELECT unique_name, name, product_category, total_damage, critical_chance, critical_multiplier,
              proc_chance, fire_rate, magazine_size, reload_time, multishot, range, fire_behaviors
       FROM weapons
       WHERE product_category IN ('LongGuns','Pistols','Melee')
       ORDER BY name`,
    )
    .all() as WeaponRow[];

  const rawMods = db
    .prepare(
      `SELECT unique_name, name, type, compat_name, description, fusion_limit, is_augment
       FROM mods
       WHERE type IN ('PRIMARY','SECONDARY','MELEE')
       ORDER BY name`,
    )
    .all() as ModRow[];
  const mods = dedupeAndCleanMods(rawMods);
  const effectsByMod = new Map<string, StatEffects>();
  for (const mod of mods) {
    effectsByMod.set(mod.unique_name, parseModEffects(mod));
  }

  const eligibleWeapons = weapons.filter((weapon) => {
    if (WEAPON_JUNK_PREFIXES.some((prefix) => weapon.unique_name.startsWith(prefix))) {
      return false;
    }
    return !isLikelyModularWeapon(weapon, modularSet);
  });

  const analyses: WeaponAnalysis[] = [];
  for (const weapon of eligibleWeapons) {
    const weaponClass = getWeaponClass(weapon.product_category);
    if (!weaponClass) continue;

    const baseline = calculateWeaponDps(weapon, emptyEffects(), weaponClass);
    const compatibleMods = mods.filter((mod) => isCompatible(mod, weapon, weaponClass));

    const modDeltas: ModDelta[] = compatibleMods
      .map((mod) => {
        const effects = effectsByMod.get(mod.unique_name) ?? emptyEffects();
        const families = getFamiliesForEffects(effects);
        if (families.length === 0) return null;
        const modded = calculateWeaponDps(weapon, effects, weaponClass);
        return {
          mod,
          effects,
          families,
          burstDeltaPct: pctDelta(modded.burstDps, baseline.burstDps),
          sustainedDeltaPct: pctDelta(modded.sustainedDps, baseline.sustainedDps),
        } satisfies ModDelta;
      })
      .filter((delta): delta is ModDelta => delta !== null);

    if (modDeltas.length === 0) continue;

    const topBurst = [...modDeltas].sort((a, b) => b.burstDeltaPct - a.burstDeltaPct)[0];
    const topSustained = [...modDeltas].sort(
      (a, b) => b.sustainedDeltaPct - a.sustainedDeltaPct,
    )[0];

    const bestByFamilyBurst = pickBestByFamily(modDeltas, 'burstDeltaPct');
    const bestByFamilySustained = pickBestByFamily(
      modDeltas,
      'sustainedDeltaPct',
    );

    analyses.push({
      weapon,
      weaponClass,
      baseline,
      modDeltas,
      bestByFamilyBurst,
      bestByFamilySustained,
      topBurst,
      topSustained,
      topBurstFamily: topFamilyFromMap(bestByFamilyBurst, 'burstDeltaPct'),
      topSustainedFamily: topFamilyFromMap(
        bestByFamilySustained,
        'sustainedDeltaPct',
      ),
      burstBuild: buildGreedy(
        weapon,
        weaponClass,
        compatibleMods,
        effectsByMod,
        'burstDps',
      ),
      sustainedBuild: buildGreedy(
        weapon,
        weaponClass,
        compatibleMods,
        effectsByMod,
        'sustainedDps',
      ),
    });
  }

  const byClass: Record<WeaponClass, WeaponAnalysis[]> = {
    primary: analyses.filter((a) => a.weaponClass === 'primary'),
    secondary: analyses.filter((a) => a.weaponClass === 'secondary'),
    melee: analyses.filter((a) => a.weaponClass === 'melee'),
  };

  interface FamilySummary {
    family: string;
    burstWinRate: number;
    sustainedWinRate: number;
    avgBestBurstDelta: number;
    avgBestSustainedDelta: number;
  }

  interface BuildFamilySummary {
    family: string;
    firstPickRate: number;
    top3AppearanceRate: number;
    avgMarginalGain: number;
  }

  function summarizeClass(classAnalyses: WeaponAnalysis[]): FamilySummary[] {
    const families = Object.keys(FAMILY_TO_KEYS);
    const summaries: FamilySummary[] = [];
    for (const family of families) {
      const burstBest = classAnalyses
        .map((analysis) => analysis.bestByFamilyBurst.get(family)?.burstDeltaPct)
        .filter((v): v is number => v != null);
      const sustainedBest = classAnalyses
        .map((analysis) => analysis.bestByFamilySustained.get(family)?.sustainedDeltaPct)
        .filter((v): v is number => v != null);

      const burstWins = classAnalyses.filter(
        (analysis) =>
          analysis.topBurstFamily != null && analysis.topBurstFamily === family,
      ).length;
      const sustainedWins = classAnalyses.filter(
        (analysis) =>
          analysis.topSustainedFamily != null && analysis.topSustainedFamily === family,
      ).length;

      summaries.push({
        family,
        burstWinRate:
          classAnalyses.length > 0 ? (burstWins / classAnalyses.length) * 100 : 0,
        sustainedWinRate:
          classAnalyses.length > 0
            ? (sustainedWins / classAnalyses.length) * 100
            : 0,
        avgBestBurstDelta: mean(burstBest),
        avgBestSustainedDelta: mean(sustainedBest),
      });
    }
    return summaries.sort((a, b) => b.burstWinRate - a.burstWinRate);
  }

  const classSummaries = {
    primary: summarizeClass(byClass.primary),
    secondary: summarizeClass(byClass.secondary),
    melee: summarizeClass(byClass.melee),
  };

  function summarizeBuildClass(
    classAnalyses: WeaponAnalysis[],
    metric: 'burst' | 'sustained',
  ): BuildFamilySummary[] {
    const totalWeapons = Math.max(classAnalyses.length, 1);
    const firstPickCounts = new Map<string, number>();
    const top3Counts = new Map<string, number>();
    const marginalGains = new Map<string, number[]>();

    for (const analysis of classAnalyses) {
      const picks =
        metric === 'burst' ? analysis.burstBuild.picks : analysis.sustainedBuild.picks;
      const first = picks[0];
      if (first) {
        firstPickCounts.set(first.family, (firstPickCounts.get(first.family) || 0) + 1);
      }
      const top3Families = new Set(picks.slice(0, 3).map((pick) => pick.family));
      for (const family of top3Families) {
        top3Counts.set(family, (top3Counts.get(family) || 0) + 1);
      }
      for (const pick of picks) {
        const list = marginalGains.get(pick.family) || [];
        list.push(pick.gainPct);
        marginalGains.set(pick.family, list);
      }
    }

    const families = new Set<string>([
      ...firstPickCounts.keys(),
      ...top3Counts.keys(),
      ...marginalGains.keys(),
    ]);

    const result: BuildFamilySummary[] = [];
    for (const family of families) {
      result.push({
        family,
        firstPickRate: ((firstPickCounts.get(family) || 0) / totalWeapons) * 100,
        top3AppearanceRate: ((top3Counts.get(family) || 0) / totalWeapons) * 100,
        avgMarginalGain: mean(marginalGains.get(family) || []),
      });
    }

    return result.sort((a, b) => b.top3AppearanceRate - a.top3AppearanceRate);
  }

  const buildSummaries = {
    primary: {
      burst: summarizeBuildClass(byClass.primary, 'burst'),
      sustained: summarizeBuildClass(byClass.primary, 'sustained'),
    },
    secondary: {
      burst: summarizeBuildClass(byClass.secondary, 'burst'),
      sustained: summarizeBuildClass(byClass.secondary, 'sustained'),
    },
    melee: {
      burst: summarizeBuildClass(byClass.melee, 'burst'),
      sustained: summarizeBuildClass(byClass.melee, 'sustained'),
    },
  };

  const contradictionsBurstVsSustained = analyses
    .filter((analysis) => {
      const burstFirst = analysis.burstBuild.picks[0];
      const sustainedFirst = analysis.sustainedBuild.picks[0];
      return (
        burstFirst &&
        sustainedFirst &&
        (burstFirst.mod.unique_name !== sustainedFirst.mod.unique_name ||
          burstFirst.family !== sustainedFirst.family)
      );
    })
    .sort((a, b) => {
      const aGap = Math.abs(
        (a.burstBuild.picks[0]?.gainPct || 0) -
          (a.sustainedBuild.picks[0]?.gainPct || 0),
      );
      const bGap = Math.abs(
        (b.burstBuild.picks[0]?.gainPct || 0) -
          (b.sustainedBuild.picks[0]?.gainPct || 0),
      );
      return bGap - aGap;
    })
    .slice(0, 20);

  const globalTopByClass = {
    primary: {
      burst: buildSummaries.primary.burst[0]?.family || 'N/A',
      sustained: buildSummaries.primary.sustained[0]?.family || 'N/A',
    },
    secondary: {
      burst: buildSummaries.secondary.burst[0]?.family || 'N/A',
      sustained: buildSummaries.secondary.sustained[0]?.family || 'N/A',
    },
    melee: {
      burst: buildSummaries.melee.burst[0]?.family || 'N/A',
      sustained: buildSummaries.melee.sustained[0]?.family || 'N/A',
    },
  };

  const classOutliers = analyses
    .filter((analysis) => {
      const burstFirst = analysis.burstBuild.picks[0];
      const sustainedFirst = analysis.sustainedBuild.picks[0];
      if (!burstFirst || !sustainedFirst) return false;
      const expectedBurst = globalTopByClass[analysis.weaponClass].burst;
      const expectedSustained = globalTopByClass[analysis.weaponClass].sustained;
      const burstFamily = burstFirst.family;
      const sustainedFamily = sustainedFirst.family;
      return burstFamily !== expectedBurst || sustainedFamily !== expectedSustained;
    })
    .slice(0, 25);

  const burstTop3CritRows = analyses.filter((analysis) => {
    const families = new Set(analysis.burstBuild.picks.slice(0, 3).map((pick) => pick.family));
    return families.has('Critical Chance') || families.has('Critical Damage');
  });
  const burstTop3NoCritRows = analyses.filter((analysis) => {
    const families = new Set(analysis.burstBuild.picks.slice(0, 3).map((pick) => pick.family));
    return !families.has('Critical Chance') && !families.has('Critical Damage');
  });
  const critTop3Chance = burstTop3CritRows.map(
    (row) => row.weapon.critical_chance ?? 0,
  );
  const nonCritTop3Chance = burstTop3NoCritRows.map(
    (row) => row.weapon.critical_chance ?? 0,
  );

  const reportLines: string[] = [];
  reportLines.push('# Weapon Mod Recommendations (Data Study)');
  reportLines.push('');
  reportLines.push('## Scope & Method');
  reportLines.push('');
  reportLines.push('- Dataset: local Parametric DB (`weapons`, `mods`) at analysis time.');
  reportLines.push('- Weapons included: `LongGuns` (primary), `Pistols` (secondary), `Melee`.');
  reportLines.push('- Excluded: rivens, archguns, modular weapons, augments, alt-fire mode modeling.');
  reportLines.push(
    '- Compatibility and DPS formulas follow current runtime logic (same assumptions as app calculations).',
  );
  reportLines.push(
    '- Evaluation approach: (1) greedy 8-slot builds (no capacity limits) to estimate practical stat priority, and (2) one-mod-at-a-time baseline deltas for reference.',
  );
  reportLines.push('- Metrics: Burst DPS delta and Sustained DPS delta.');
  reportLines.push('');
  reportLines.push(`- Eligible weapons analyzed: **${analyses.length}**`);
  reportLines.push(`  - Primary: **${byClass.primary.length}**`);
  reportLines.push(`  - Secondary: **${byClass.secondary.length}**`);
  reportLines.push(`  - Melee: **${byClass.melee.length}**`);
  reportLines.push('');

  function appendClassSection(
    label: string,
    oneModSummaries: FamilySummary[],
    burstBuildSummary: BuildFamilySummary[],
    sustainedBuildSummary: BuildFamilySummary[],
  ): void {
    reportLines.push(`## ${label}`);
    reportLines.push('');
    reportLines.push('### Build-Priority View (Greedy 8-slot, no capacity constraints)');
    reportLines.push('');
    reportLines.push('| Stat Family | Burst First-Pick Rate | Burst Top-3 Presence | Sustained First-Pick Rate | Sustained Top-3 Presence | Avg Marginal Gain When Picked |');
    reportLines.push('|---|---:|---:|---:|---:|---:|');
    const families = new Set<string>([
      ...burstBuildSummary.map((row) => row.family),
      ...sustainedBuildSummary.map((row) => row.family),
    ]);
    const orderedFamilies = Array.from(families).sort((a, b) => {
      const aScore =
        (burstBuildSummary.find((row) => row.family === a)?.top3AppearanceRate || 0) +
        (sustainedBuildSummary.find((row) => row.family === a)?.top3AppearanceRate || 0);
      const bScore =
        (burstBuildSummary.find((row) => row.family === b)?.top3AppearanceRate || 0) +
        (sustainedBuildSummary.find((row) => row.family === b)?.top3AppearanceRate || 0);
      return bScore - aScore;
    });
    for (const family of orderedFamilies.slice(0, 10)) {
      const burst = burstBuildSummary.find((row) => row.family === family);
      const sustained = sustainedBuildSummary.find((row) => row.family === family);
      reportLines.push(
        `| ${family} | ${fmtPct(burst?.firstPickRate || 0)} | ${fmtPct(
          burst?.top3AppearanceRate || 0,
        )} | ${fmtPct(sustained?.firstPickRate || 0)} | ${fmtPct(
          sustained?.top3AppearanceRate || 0,
        )} | ${fmtPct(
          mean([burst?.avgMarginalGain || 0, sustained?.avgMarginalGain || 0]),
        )} |`,
      );
    }
    reportLines.push('');
    const burstTop = burstBuildSummary[0];
    const sustainedTop = sustainedBuildSummary[0];
    reportLines.push(
      `Top burst early-pick family: **${burstTop?.family || 'N/A'}** (${fmtPct(
        burstTop?.top3AppearanceRate || 0,
      )} win rate).`,
    );
    reportLines.push(
      `Top sustained early-pick family: **${sustainedTop?.family || 'N/A'}** (${fmtPct(
        sustainedTop?.top3AppearanceRate || 0,
      )} win rate).`,
    );
    reportLines.push('');
    reportLines.push('### Single-Mod Baseline View');
    reportLines.push('');
    reportLines.push('| Stat Family | Burst Win Rate | Sustained Win Rate | Avg Best Burst Delta | Avg Best Sustained Delta |');
    reportLines.push('|---|---:|---:|---:|---:|');
    for (const row of oneModSummaries.slice(0, 8)) {
      reportLines.push(
        `| ${row.family} | ${fmtPct(row.burstWinRate)} | ${fmtPct(row.sustainedWinRate)} | ${fmtPct(row.avgBestBurstDelta)} | ${fmtPct(row.avgBestSustainedDelta)} |`,
      );
    }
    reportLines.push('');
  }

  appendClassSection(
    'Primary Recommendations',
    classSummaries.primary,
    buildSummaries.primary.burst,
    buildSummaries.primary.sustained,
  );
  appendClassSection(
    'Secondary Recommendations',
    classSummaries.secondary,
    buildSummaries.secondary.burst,
    buildSummaries.secondary.sustained,
  );
  appendClassSection(
    'Melee Recommendations',
    classSummaries.melee,
    buildSummaries.melee.burst,
    buildSummaries.melee.sustained,
  );

  reportLines.push('## Cross-Stat Findings');
  reportLines.push('');
  reportLines.push(
    `- In greedy burst builds, crit-focused families (Crit Chance/Crit Damage) appear in the first 3 picks on **${fmtPct(
      (burstTop3CritRows.length / Math.max(analyses.length, 1)) * 100,
    )}** of analyzed weapons.`,
  );
  reportLines.push(
    `- Weapons with crit in burst top-3 picks have median base crit chance **${fmtNum(
      median(critTop3Chance),
    )}**; weapons without crit in burst top-3 have median **${fmtNum(
      median(nonCritTop3Chance),
    )}**.`,
  );
  reportLines.push(
    '- Sustained recommendations diverge from burst especially on reload-heavy ranged weapons, where Reload Speed and Magazine Capacity become more competitive.',
  );
  reportLines.push('');

  reportLines.push('## Contradictory Findings (Review List)');
  reportLines.push('');
  reportLines.push(
    'These are cases where burst and sustained suggest different top mods/families or where weapon-level recommendations diverge from class-level trends.',
  );
  reportLines.push('');
  reportLines.push('### Burst vs Sustained Disagreement (Top 20)');
  reportLines.push('');
  reportLines.push('| Weapon | Class | Top Burst Family | Top Burst Mod | Burst Gain | Top Sustained Family | Top Sustained Mod | Sustained Gain |');
  reportLines.push('|---|---|---|---|---:|---|---|---:|');
  for (const row of contradictionsBurstVsSustained) {
    const burstFirst = row.burstBuild.picks[0];
    const sustainedFirst = row.sustainedBuild.picks[0];
    reportLines.push(
      `| ${row.weapon.name} | ${row.weaponClass} | ${burstFirst?.family || 'N/A'} | ${burstFirst?.mod.name || 'N/A'} | ${fmtPct(burstFirst?.gainPct || 0)} | ${sustainedFirst?.family || 'N/A'} | ${sustainedFirst?.mod.name || 'N/A'} | ${fmtPct(sustainedFirst?.gainPct || 0)} |`,
    );
  }
  if (contradictionsBurstVsSustained.length === 0) {
    reportLines.push(
      '| _No major burst vs sustained first-pick contradictions under current assumptions._ | - | - | - | - | - | - | - |',
    );
  }
  reportLines.push('');

  reportLines.push('### Class Trend Outliers (Sample)');
  reportLines.push('');
  reportLines.push('| Weapon | Class | Top Burst Family | Top Sustained Family | Top Burst Mod | Top Sustained Mod |');
  reportLines.push('|---|---|---|---|---|---|');
  for (const row of classOutliers) {
    const burstFirst = row.burstBuild.picks[0];
    const sustainedFirst = row.sustainedBuild.picks[0];
    reportLines.push(
      `| ${row.weapon.name} | ${row.weaponClass} | ${burstFirst?.family || 'N/A'} | ${sustainedFirst?.family || 'N/A'} | ${burstFirst?.mod.name || 'N/A'} | ${sustainedFirst?.mod.name || 'N/A'} |`,
    );
  }
  if (classOutliers.length === 0) {
    reportLines.push(
      '| _No strong class outliers under current assumptions._ | - | - | - | - | - |',
    );
  }
  reportLines.push('');

  reportLines.push('## New Player Rules of Thumb');
  reportLines.push('');
  reportLines.push('- Start with the stat family that wins most often for your weapon class in this report.');
  reportLines.push('- Prefer burst-oriented recommendations for short engagements and one-shot breakpoints.');
  reportLines.push('- Prefer sustained-oriented recommendations for long firing windows and high reload burden.');
  reportLines.push(
    '- If your weapon has high base crit chance, crit-focused mods are more likely to outperform base damage in burst.',
  );
  reportLines.push(
    '- Review contradiction tables before finalizing a build; outlier weapons can break class-level rules.',
  );
  reportLines.push('');

  const reportsDir = path.join(PROJECT_ROOT, 'data', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  const reportPath = path.join(reportsDir, 'weapon-mod-recommendations.md');
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');

  console.log(`[Study] Wrote report: ${reportPath}`);
  console.log(`[Study] Weapons analyzed: ${analyses.length}`);
}

try {
  runStudy();
} finally {
  closeAll();
}

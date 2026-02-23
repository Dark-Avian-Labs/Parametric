// ==============================
// Shared card layout types, defaults, and helpers
// ==============================

export const RARITIES = [
  'Empty',
  'Common',
  'Uncommon',
  'Rare',
  'Legendary',
  'Amalgam',
  'Galvanized',
  'Archon',
  'Riven',
] as const;

export const SLOT_ICONS = ['', 'aura', 'stance', 'exilus'] as const;
export type SlotIcon = (typeof SLOT_ICONS)[number];
export type Rarity = (typeof RARITIES)[number];

export const DAMAGE_COLORS: Record<string, string> = {
  none: 'transparent',
  base: '#ffffff',
  impact: '#8888cc',
  puncture: '#aaaaaa',
  slash: '#cccc44',
  heat: '#ff6600',
  cold: '#6699ff',
  electricity: '#99ccff',
  toxin: '#44cc44',
  blast: '#ffaa00',
  radiation: '#ccaa44',
  gas: '#88cc66',
  magnetic: '#6666cc',
  viral: '#66ccaa',
  corrosive: '#aacc44',
  void: '#6688cc',
};

export function getRarityBorderColor(rarity: Rarity): string {
  switch (rarity) {
    case 'Common':
      return '#90784e';
    case 'Uncommon':
      return '#8a9eaa';
    case 'Rare':
      return '#b4922a';
    case 'Legendary':
      return '#c0c0c0';
    case 'Amalgam':
      return '#7a4a5a';
    case 'Galvanized':
      return '#c0c0c0';
    case 'Archon':
      return '#c47040';
    case 'Riven':
      return '#9880c8';
    case 'Empty':
      return '#3a3a3a';
    default:
      return '#666';
  }
}

export function getModAsset(
  rarity: Rarity,
  part: string,
  modSet?: string,
): string {
  if (modSet && part === 'FrameTop') {
    const setFolder = modSet.split('/').pop();
    if (setFolder) return `/icons/mods/sets/${setFolder}/${rarity}FrameTop.png`;
  }
  if (
    rarity === 'Galvanized' &&
    ['Background', 'SideLight', 'LowerTab'].includes(part)
  ) {
    return `/icons/mods/Legendary${part}.png`;
  }
  return `/icons/mods/${rarity}${part}.png`;
}

/** Map DB rarity (COMMON, UNCOMMON, etc.) to card rarity name.
 *  Pass the mod name or unique_name to detect special visual rarities
 *  like Archon mods (which are RARE in the DB but use distinct borders). */
export function dbRarityToCardRarity(
  dbRarity?: string,
  modName?: string,
): Rarity {
  if (modName && isArchonMod(modName)) return 'Archon';
  switch (dbRarity?.toUpperCase()) {
    case 'COMMON':
      return 'Common';
    case 'UNCOMMON':
      return 'Uncommon';
    case 'RARE':
      return 'Rare';
    case 'LEGENDARY':
      return 'Legendary';
    default:
      return 'Common';
  }
}

/** Detect Archon rarity mods by name prefix or unique_name path */
export function isArchonMod(nameOrUniqueName: string): boolean {
  return (
    nameOrUniqueName.startsWith('Archon ') ||
    nameOrUniqueName.includes('/Archon/')
  );
}

/** Map DB polarity key (AP_ATTACK, etc.) to lowercase icon name */
export function dbPolarityToIconName(dbPolarity?: string): string {
  switch (dbPolarity) {
    case 'AP_ATTACK':
      return 'madurai';
    case 'AP_DEFENSE':
      return 'vazarin';
    case 'AP_TACTIC':
      return 'naramon';
    case 'AP_WARD':
      return 'unairu';
    case 'AP_POWER':
      return 'zenurik';
    case 'AP_PRECEPT':
      return 'penjaga';
    case 'AP_UMBRA':
      return 'umbra';
    case 'AP_ANY':
      return 'universal';
    default:
      return '';
  }
}

// ==============================
// Layout interface & defaults
// ==============================

export interface CardLayout {
  // Card container
  cardWidth: number;
  cardHeight: number;
  collapsedHeight: number;
  cardOffsetY: number;

  // Background
  bgOffsetX: number;
  bgOffsetY: number;
  bgWidth: number;
  bgHeight: number;

  // Mod art (the gameplay image)
  artOffsetX: number;
  artOffsetY: number;
  artWidth: number;
  artHeight: number;

  // Frame top
  frameTopOffsetX: number;
  frameTopOffsetY: number;
  frameTopWidth: number;
  frameTopHeight: number;

  // Frame bottom
  frameBotOffsetX: number;
  frameBotOffsetY: number;
  frameBotWidth: number;
  frameBotHeight: number;

  // Side lights (left)
  sideLeftOffsetX: number;
  sideLeftOffsetY: number;
  sideLeftWidth: number;
  sideLeftHeight: number;

  // Lower tab (rank area)
  lowerTabOffsetX: number;
  lowerTabOffsetY: number;
  lowerTabWidth: number;
  lowerTabHeight: number;

  // Polarity icon
  polarityOffsetX: number;
  polarityOffsetY: number;
  polaritySize: number;

  // Slot icon (aura/stance/exilus) — top center
  slotIconOffsetY: number;
  slotIconSize: number;

  // Text content area (art clipping boundary)
  contentAreaY: number;

  // Text block
  textPaddingX: number;
  nameOffsetY: number;
  nameFontSize: number;

  // Mod description text
  descOffsetY: number;
  descFontSize: number;

  // Lower tab type text
  typeFontSize: number;

  // Rank stars
  rankOffsetY: number;
  rankStarSize: number;
  rankStarGap: number;

  // Drain badge (background shape)
  drainOffsetX: number;
  drainOffsetY: number;
  drainBadgeWidth: number;
  drainBadgeHeight: number;

  // Drain number text (independent position)
  drainTextOffsetX: number;
  drainTextOffsetY: number;
  drainFontSize: number;

  // Damage badge (top-left)
  damageBadgeOffsetX: number;
  damageBadgeOffsetY: number;
  damageBadgeWidth: number;
  damageBadgeHeight: number;
  damageBadgeFontSize: number;

  // Collapsed-specific overrides
  collapsedArtHeight: number;
  collapsedFrameBotOffsetY: number;
  collapsedFrameBotHeight: number;
  collapsedNameOffsetY: number;
  collapsedNameFontSize: number;
  collapsedRankOffsetY: number;
  collapsedRankStarSize: number;

  // Overall scale
  scale: number;
}

// ==============================
// Arcane card layout
// ==============================

export interface ArcaneCardLayout {
  cardWidth: number;
  cardHeight: number;
  collapsedHeight: number;
  cardOffsetY: number;

  // Background (from /icons/arcane/)
  bgOffsetX: number;
  bgOffsetY: number;
  bgWidth: number;
  bgHeight: number;

  // Art overlay
  artOffsetX: number;
  artOffsetY: number;
  artWidth: number;
  artHeight: number;

  // Name text
  textPaddingX: number;
  nameOffsetY: number;
  nameFontSize: number;

  // Diamond rank row
  diamondOffsetY: number;
  diamondSize: number;
  diamondGap: number;

  // Collapsed overrides
  collapsedArtHeight: number;
  collapsedNameOffsetY: number;
  collapsedNameFontSize: number;
  collapsedDiamondOffsetY: number;
  collapsedDiamondSize: number;

  scale: number;
}

export const DEFAULT_ARCANE_LAYOUT: ArcaneCardLayout = {
  cardWidth: 256,
  cardHeight: 120,
  collapsedHeight: 110,
  cardOffsetY: -72,

  bgOffsetX: 0,
  bgOffsetY: 0,
  bgWidth: 256,
  bgHeight: 256,

  artOffsetX: 90,
  artOffsetY: 90,
  artWidth: 76,
  artHeight: 76,

  textPaddingX: 20,
  nameOffsetY: 135,
  nameFontSize: 14,

  diamondOffsetY: 170,
  diamondSize: 14,
  diamondGap: 4,

  collapsedArtHeight: 60,
  collapsedNameOffsetY: 70,
  collapsedNameFontSize: 14,
  collapsedDiamondOffsetY: 92,
  collapsedDiamondSize: 10,

  scale: 1.5,
};

export type ArcaneRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'legendary'
  | 'empty';

export function getArcaneAsset(rarity?: string): string {
  const map: Record<string, string> = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    LEGENDARY: 'legendary',
  };
  const key = map[(rarity || '').toUpperCase()] || 'empty';
  return `/icons/arcane/${key}.png`;
}

// ==============================
// Mod card defaults
// ==============================

export const DEFAULT_LAYOUT: CardLayout = {
  cardWidth: 256,
  cardHeight: 346,
  collapsedHeight: 116,
  cardOffsetY: -58,

  bgOffsetX: 0,
  bgOffsetY: 0,
  bgWidth: 228,
  bgHeight: 460,

  artOffsetX: 22,
  artOffsetY: 78,
  artWidth: 212,
  artHeight: 212,

  frameTopOffsetX: 0,
  frameTopOffsetY: 54,
  frameTopWidth: 256,
  frameTopHeight: 116,

  frameBotOffsetX: 0,
  frameBotOffsetY: 290,
  frameBotWidth: 256,
  frameBotHeight: 116,

  sideLeftOffsetX: 16,
  sideLeftOffsetY: 90,
  sideLeftWidth: 16,
  sideLeftHeight: 256,

  lowerTabOffsetX: 0,
  lowerTabOffsetY: 345,
  lowerTabWidth: 180,
  lowerTabHeight: 20,

  polarityOffsetX: 217,
  polarityOffsetY: 87,
  polaritySize: 14,

  slotIconOffsetY: 80,
  slotIconSize: 32,

  contentAreaY: 262,

  textPaddingX: 30,
  nameOffsetY: 286,
  nameFontSize: 18,

  descOffsetY: 340,
  descFontSize: 14,

  typeFontSize: 12,

  rankOffsetY: 386,
  rankStarSize: 8,
  rankStarGap: 1,

  drainOffsetX: 176,
  drainOffsetY: 82,
  drainBadgeWidth: 70,
  drainBadgeHeight: 24,

  drainTextOffsetX: 197,
  drainTextOffsetY: 86,
  drainFontSize: 14,

  damageBadgeOffsetX: 26,
  damageBadgeOffsetY: 82,
  damageBadgeWidth: 60,
  damageBadgeHeight: 24,
  damageBadgeFontSize: 12,

  collapsedArtHeight: 78,
  collapsedFrameBotOffsetY: 96,
  collapsedFrameBotHeight: 80,
  collapsedNameOffsetY: 107,
  collapsedNameFontSize: 20,
  collapsedRankOffsetY: 160,
  collapsedRankStarSize: 8,

  scale: 1.5,
};

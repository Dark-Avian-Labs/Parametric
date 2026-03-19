export type ArcaneCompatTag =
  | 'warframe'
  | 'primary'
  | 'secondary'
  | 'melee'
  | 'weapon'
  | 'kitgun'
  | 'zaw'
  | 'operator'
  | 'amp';

export function classifyArcaneCompatTags(
  uniqueNameRaw: unknown,
  nameRaw: unknown,
): ArcaneCompatTag[] {
  const uniqueName = String(uniqueNameRaw ?? '').toLowerCase();
  const name = String(nameRaw ?? '').toLowerCase();
  const tags = new Set<ArcaneCompatTag>();

  if (uniqueName.includes('/operatoramps/') || name.startsWith('virtuos ')) {
    tags.add('amp');
  }
  if (
    uniqueName.includes('/operatorarmour/') ||
    (uniqueName.includes('/operator') && !uniqueName.includes('/operatoramps/')) ||
    name.startsWith('magus ') ||
    name.includes(' operator ')
  ) {
    tags.add('operator');
  }
  if (name.startsWith('pax ')) {
    tags.add('kitgun');
    tags.add('secondary');
    tags.add('weapon');
  }
  if (name.startsWith('exodia ')) {
    tags.add('zaw');
    tags.add('melee');
    tags.add('weapon');
  }
  if (
    name.startsWith('primary ') ||
    name.includes(' primary ') ||
    uniqueName.includes('primary') ||
    uniqueName.includes('rifle') ||
    uniqueName.includes('shotgun')
  ) {
    tags.add('primary');
  }
  if (
    name.startsWith('secondary ') ||
    name.includes(' secondary ') ||
    uniqueName.includes('secondary') ||
    uniqueName.includes('pistol')
  ) {
    tags.add('secondary');
  }
  if (name.startsWith('melee ') || name.includes(' melee ') || uniqueName.includes('melee')) {
    tags.add('melee');
  }
  if (
    name.startsWith('residual ') ||
    name.startsWith('theorem ') ||
    (name.includes('merciless') &&
      !tags.has('primary') &&
      !tags.has('secondary') &&
      !tags.has('melee')) ||
    (name.includes('dexterity') &&
      !tags.has('primary') &&
      !tags.has('secondary') &&
      !tags.has('melee')) ||
    (name.includes('deadhead') &&
      !tags.has('primary') &&
      !tags.has('secondary') &&
      !tags.has('melee'))
  ) {
    tags.add('weapon');
  }

  if (uniqueName.includes('/zariman/')) {
    if (name.includes('amp ')) tags.add('amp');
    if (name.includes('operator ')) tags.add('operator');
    if (name.includes('primary')) tags.add('primary');
    if (name.includes('secondary')) tags.add('secondary');
    if (name.includes('melee')) tags.add('melee');
  }

  if (
    !tags.has('amp') &&
    !tags.has('operator') &&
    !tags.has('kitgun') &&
    !tags.has('zaw') &&
    !tags.has('primary') &&
    !tags.has('secondary') &&
    !tags.has('melee')
  ) {
    tags.add('warframe');
  }

  return Array.from(tags).sort();
}

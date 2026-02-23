export function sanitizeDisplayText(value: unknown): string {
  if (typeof value !== 'string') return '';

  // Remove HTML-like tags, then strip any remaining angle brackets from broken tags.
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .trim();
}

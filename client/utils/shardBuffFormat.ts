/** Matches paired base/(tau) values in shard buff descriptions from the database. */
export function formatShardBuffDescription(
  buff: { description: string } | undefined,
  tauforged: boolean,
): string {
  if (!buff) return '';
  return buff.description.replace(/([+-]?\d+\.?\d*%?)\s*\(([+-]?\d+\.?\d*%?)\)/g, (_, base, tau) =>
    tauforged ? tau : base,
  );
}

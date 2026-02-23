import * as cheerio from 'cheerio';

import { getDb } from '../db/connection.js';

const BASE_URL = 'https://overframe.gg';

export interface OverframeIndexEntry {
  overframeId: number;
  slug: string;
  name: string;
  category: string;
  /** Our DB unique_name if matched, otherwise null */
  dbUniqueName: string | null;
}

const CATEGORY_URLS: Record<string, string> = {
  warframe: '/build/new/',
  primary: '/build/new/primary-weapons/',
  secondary: '/build/new/secondary-weapons/',
  melee: '/build/new/melee-weapons/',
  archwing: '/build/new/archwing/',
  companion: '/build/new/sentinels/',
};

/**
 * Fetch a single category page and extract item links.
 */
async function scrapeCategory(
  category: string,
  urlPath: string,
): Promise<OverframeIndexEntry[]> {
  const url = `${BASE_URL}${urlPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const entries: OverframeIndexEntry[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/^\/build\/new\/(\d+)\/([^/]+)\/?$/);
    if (!match) return;

    const overframeId = parseInt(match[1], 10);
    const slug = match[2];
    const name = $(el).text().trim();
    if (name && overframeId) {
      entries.push({ overframeId, slug, name, category, dbUniqueName: null });
    }
  });

  return entries;
}

/**
 * Match scraped entries against our DB by item name.
 * Returns only entries that have a matching DB row.
 * If onlyMissing is true, filters out entries that already have artifact_slots data.
 */
function matchToDb(
  entries: OverframeIndexEntry[],
  onlyMissing = false,
): OverframeIndexEntry[] {
  const db = getDb();

  const warframes = db
    .prepare('SELECT unique_name, name FROM warframes')
    .all() as { unique_name: string; name: string }[];
  const weapons = db.prepare('SELECT unique_name, name FROM weapons').all() as {
    unique_name: string;
    name: string;
  }[];
  const companions = db
    .prepare('SELECT unique_name, name FROM companions')
    .all() as { unique_name: string; name: string }[];

  const nameMap = new Map<string, string>();
  for (const item of [...warframes, ...weapons, ...companions]) {
    nameMap.set(item.name.toLowerCase(), item.unique_name);
  }

  let hasDataSet: Set<string> | null = null;
  if (onlyMissing) {
    hasDataSet = new Set<string>();
    for (const table of ['warframes', 'weapons', 'companions']) {
      const rows = db
        .prepare(
          `SELECT unique_name FROM ${table} WHERE artifact_slots IS NOT NULL`,
        )
        .all() as { unique_name: string }[];
      for (const row of rows) hasDataSet.add(row.unique_name);
    }
  }

  const matched: OverframeIndexEntry[] = [];
  for (const entry of entries) {
    const uniqueName = nameMap.get(entry.name.toLowerCase());
    if (uniqueName) {
      if (hasDataSet && hasDataSet.has(uniqueName)) continue;
      matched.push({ ...entry, dbUniqueName: uniqueName });
    }
  }

  return matched;
}

export interface IndexScrapeResult {
  totalFound: number;
  matched: number;
  entries: OverframeIndexEntry[];
}

/**
 * Scrape all category index pages and match to DB.
 * @param categories - Optional list of categories to scrape (defaults to all)
 * @param onProgress - Optional callback for progress updates
 * @param onlyMissing - If true, skip items that already have artifact_slots data
 */
export async function scrapeIndex(
  categories?: string[],
  onProgress?: (msg: string) => void,
  onlyMissing = false,
): Promise<IndexScrapeResult> {
  const cats = categories?.length
    ? Object.entries(CATEGORY_URLS).filter(([k]) => categories.includes(k))
    : Object.entries(CATEGORY_URLS);

  const allEntries: OverframeIndexEntry[] = [];

  for (const [category, urlPath] of cats) {
    onProgress?.(`Scraping index: ${category}...`);
    const entries = await scrapeCategory(category, urlPath);
    allEntries.push(...entries);
    onProgress?.(`Found ${entries.length} items in ${category}`);
  }

  onProgress?.(`Total found: ${allEntries.length}. Matching to database...`);
  const matched = matchToDb(allEntries, onlyMissing);
  if (onlyMissing) {
    onProgress?.(
      `${matched.length} items need scraping (${allEntries.length - matched.length} already have data)`,
    );
  } else {
    onProgress?.(
      `Matched ${matched.length} of ${allEntries.length} to database`,
    );
  }

  return {
    totalFound: allEntries.length,
    matched: matched.length,
    entries: matched,
  };
}

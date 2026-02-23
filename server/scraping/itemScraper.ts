import * as cheerio from 'cheerio';

import type { OverframeIndexEntry } from './indexScraper.js';

const BASE_URL = 'https://overframe.gg';

export interface ScrapedAbilityStat {
  label: string;
  value: string;
}

export interface ScrapedAbility {
  name: string;
  description: string;
  stats: ScrapedAbilityStat[];
}

export interface ScrapedItemData {
  entry: OverframeIndexEntry;
  nextData: Record<string, unknown>;
  itemData: Record<string, unknown>;
  artifactSlots: string[];
  abilities: ScrapedAbility[];
  fireBehaviors: Record<string, unknown>[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrape a single item page from Overframe.
 */
export async function scrapeItemPage(
  entry: OverframeIndexEntry,
): Promise<ScrapedItemData> {
  const url = `${BASE_URL}/build/new/${entry.overframeId}/${entry.slug}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  // Extract __NEXT_DATA__ JSON
  const scriptContent = $('#__NEXT_DATA__').html();
  if (!scriptContent) throw new Error(`No __NEXT_DATA__ found on ${url}`);

  const nextData = JSON.parse(scriptContent);
  const itemData = nextData?.props?.pageProps?.item?.data || {};

  const artifactSlots: string[] = itemData.ArtifactSlots || [];
  const fireBehaviors: Record<string, unknown>[] = itemData.Behaviors || [];

  // Extract ability tooltips from HTML
  const abilities: ScrapedAbility[] = [];
  $('[class*="abilityTooltip"]').each((_, tooltipEl) => {
    const $tip = $(tooltipEl);
    const name = $tip.find('h1').first().text().trim();
    const description = $tip.find('.wfic').first().text().trim();
    const stats: ScrapedAbilityStat[] = [];

    $tip.find('[class*="abilityTooltipStatLine"]').each((__, statEl) => {
      const $stat = $(statEl);
      const divs = $stat.children('div');
      if (divs.length >= 2) {
        stats.push({
          label: $(divs[0]).text().trim(),
          value: $(divs[1]).text().trim(),
        });
      }
    });

    if (name) {
      abilities.push({ name, description, stats });
    }
  });

  return {
    entry,
    nextData,
    itemData,
    artifactSlots,
    abilities,
    fireBehaviors,
  };
}

export interface ScrapeProgress {
  current: number;
  total: number;
  currentItem: string;
  phase: 'index' | 'items' | 'merging' | 'done';
}

/**
 * Scrape multiple items sequentially with a delay between requests.
 * @param entries - Items to scrape
 * @param delayMs - Delay between requests (default 1500ms)
 * @param onProgress - Progress callback
 */
export async function scrapeItems(
  entries: OverframeIndexEntry[],
  delayMs = 1500,
  onProgress?: (progress: ScrapeProgress) => void,
): Promise<ScrapedItemData[]> {
  const results: ScrapedItemData[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    onProgress?.({
      current: i + 1,
      total: entries.length,
      currentItem: entry.name,
      phase: 'items',
    });

    try {
      const data = await scrapeItemPage(entry);
      results.push(data);
    } catch (err) {
      console.warn(
        `[Scraper] Failed to scrape ${entry.name}:`,
        err instanceof Error ? err.message : err,
      );
    }

    if (i < entries.length - 1) {
      await sleep(delayMs);
    }
  }

  return results;
}

import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { processExports, backfillModDescriptions } from '../db/queries.js';
import { createAppSchema } from '../db/schema.js';
import { downloadImages } from '../import/images.js';
import {
  runImportPipeline,
  listExportFiles,
  readExportFile,
  type ImportStatus,
} from '../import/pipeline.js';
import { mergeScrapedData, type MergeResult } from '../scraping/dataMerger.js';
import { scrapeIndex } from '../scraping/indexScraper.js';
import { scrapeItems, type ScrapeProgress } from '../scraping/itemScraper.js';
import {
  runWikiScrape,
  type WikiScrapeProgress,
  type WikiMergeResult,
} from '../scraping/wikiScraper.js';

export const importRouter = Router();

importRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

let importRunning = false;
const importLog: ImportStatus[] = [];

/**
 * POST /api/import/run
 * Trigger the full import pipeline (download manifest + export files).
 */
importRouter.post('/run', async (_req: Request, res: Response) => {
  if (importRunning) {
    res.status(409).json({ error: 'Import already in progress' });
    return;
  }

  importRunning = true;
  importLog.length = 0;

  try {
    const results = await runImportPipeline((status) => {
      importLog.push(status);
    });

    importRunning = false;
    res.json({ success: true, files: results, log: importLog });
  } catch (err) {
    importRunning = false;
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg, log: importLog });
  }
});

/**
 * GET /api/import/status
 * Get current import status / log.
 */
importRouter.get('/status', (_req: Request, res: Response) => {
  res.json({
    running: importRunning,
    log: importLog,
  });
});

/**
 * GET /api/import/files
 * List all downloaded export files.
 */
importRouter.get('/files', (_req: Request, res: Response) => {
  try {
    const files = listExportFiles();
    res.json({ files });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/import/files/:category
 * Read and return the contents of a specific export file.
 * Supports pagination via ?key=<arrayKey>&offset=<n>&limit=<n>
 */
importRouter.get('/files/:category', (req: Request, res: Response) => {
  try {
    const category = String(req.params.category);
    const content = readExportFile(category) as Record<string, unknown>;

    // If a specific key is requested, paginate that array
    const key = typeof req.query.key === 'string' ? req.query.key : undefined;
    const offset =
      parseInt(typeof req.query.offset === 'string' ? req.query.offset : '0') ||
      0;
    const limit =
      parseInt(typeof req.query.limit === 'string' ? req.query.limit : '50') ||
      50;

    if (key && content[key] && Array.isArray(content[key])) {
      const arr = content[key] as unknown[];
      const slice = arr.slice(offset, offset + limit);
      res.json({
        key,
        total: arr.length,
        offset,
        limit,
        items: slice,
      });
      return;
    }

    // Return summary: list top-level keys and their array lengths
    const summary: Record<
      string,
      { type: string; count?: number; sample?: unknown }
    > = {};
    for (const [k, v] of Object.entries(content)) {
      if (Array.isArray(v)) {
        summary[k] = { type: 'array', count: v.length, sample: v[0] };
      } else if (typeof v === 'object' && v !== null) {
        summary[k] = { type: 'object' };
      } else {
        summary[k] = { type: typeof v };
      }
    }

    res.json({ category, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/import/process
 * Process downloaded exports into the database.
 */
importRouter.post('/process', (_req: Request, res: Response) => {
  try {
    createAppSchema();
    const counts = processExports();
    res.json({ success: true, ...counts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/import/backfill-descriptions
 * Backfill mod descriptions from mod_level_stats for mods missing them.
 */
importRouter.post('/backfill-descriptions', (_req: Request, res: Response) => {
  try {
    const count = backfillModDescriptions();
    res.json({ success: true, updated: count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/import/images
 * Download images for items in the database only (warframes, weapons, companions, mods).
 * Uses hash-based caching and concurrent downloads.
 * Prerequisite: run /process first so the DB is populated.
 */
importRouter.post('/images', async (_req: Request, res: Response) => {
  if (importRunning) {
    res.status(409).json({ error: 'Import already in progress' });
    return;
  }

  importRunning = true;
  try {
    const result = await downloadImages((done, total, current) => {
      if (done % 100 === 0 || done === total) {
        console.log(`[Images] ${done}/${total}: ${current}`);
      }
    });
    importRunning = false;
    res.json({ success: true, ...result });
  } catch (err) {
    importRunning = false;
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/* ──────────────────── Overframe Scraper ──────────────────── */

let scrapeRunning = false;
let scrapeProgress: ScrapeProgress & {
  log: string[];
  mergeResult?: MergeResult;
} = {
  current: 0,
  total: 0,
  currentItem: '',
  phase: 'done',
  log: [],
};

/**
 * POST /api/import/scrape
 * Trigger the Overframe scrape pipeline.
 * Body: { categories?: string[] }  (defaults to all)
 */
importRouter.post('/scrape', async (req: Request, res: Response) => {
  if (scrapeRunning || importRunning) {
    res.status(409).json({ error: 'Import or scrape already in progress' });
    return;
  }

  scrapeRunning = true;
  scrapeProgress = {
    current: 0,
    total: 0,
    currentItem: '',
    phase: 'index',
    log: [],
  };

  const categories = Array.isArray(req.body?.categories)
    ? req.body.categories
    : undefined;
  const onlyMissing = req.body?.onlyMissing === true;

  res.json({ started: true });

  try {
    scrapeProgress.log.push('Starting index scrape...');
    const indexResult = await scrapeIndex(
      categories,
      (msg) => {
        scrapeProgress.log.push(msg);
      },
      onlyMissing,
    );

    scrapeProgress.total = indexResult.entries.length;
    scrapeProgress.log.push(
      `Index complete: ${indexResult.matched} items matched`,
    );

    scrapeProgress.phase = 'items';
    const scrapedItems = await scrapeItems(indexResult.entries, 1500, (p) => {
      scrapeProgress.current = p.current;
      scrapeProgress.total = p.total;
      scrapeProgress.currentItem = p.currentItem;
    });

    scrapeProgress.phase = 'merging';
    scrapeProgress.log.push(
      `Scraping done. Merging ${scrapedItems.length} items into DB...`,
    );

    const mergeResult = mergeScrapedData(scrapedItems, (msg) => {
      scrapeProgress.log.push(msg);
    });

    scrapeProgress.mergeResult = mergeResult;
    scrapeProgress.log.push(
      `Merge complete: ${mergeResult.warframesUpdated} warframes, ` +
        `${mergeResult.weaponsUpdated} weapons, ` +
        `${mergeResult.companionsUpdated} companions, ` +
        `${mergeResult.abilitiesUpdated} abilities updated`,
    );

    scrapeProgress.phase = 'done';
  } catch (err) {
    scrapeProgress.log.push(
      `ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
    scrapeProgress.phase = 'done';
  } finally {
    scrapeRunning = false;
  }
});

/**
 * GET /api/import/scrape/status
 * Poll scrape progress.
 */
importRouter.get('/scrape/status', (_req: Request, res: Response) => {
  res.json({
    running: scrapeRunning,
    ...scrapeProgress,
  });
});

/* ──────────────────── Wiki Scraper ──────────────────── */

let wikiRunning = false;
let wikiProgress: WikiScrapeProgress & { mergeResult?: WikiMergeResult } = {
  phase: 'done',
  current: 0,
  total: 0,
  currentItem: '',
  log: [],
};

/**
 * POST /api/import/wiki-scrape
 * Trigger the wiki scrape pipeline (abilities, passives, augments).
 */
importRouter.post('/wiki-scrape', async (req: Request, res: Response) => {
  if (wikiRunning || scrapeRunning || importRunning) {
    res
      .status(409)
      .json({ error: 'Another import/scrape is already in progress' });
    return;
  }

  wikiRunning = true;
  wikiProgress = {
    phase: 'augments',
    current: 0,
    total: 0,
    currentItem: '',
    log: [],
  };

  res.json({ started: true });

  const onlyMissing = req.body?.onlyMissing === true;

  try {
    const mergeResult = await runWikiScrape((p) => {
      wikiProgress.phase = p.phase;
      wikiProgress.current = p.current;
      wikiProgress.total = p.total;
      wikiProgress.currentItem = p.currentItem;
      wikiProgress.log = p.log;
    }, onlyMissing);
    wikiProgress.mergeResult = mergeResult;
    wikiProgress.phase = 'done';
  } catch (err) {
    wikiProgress.log.push(
      `ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
    wikiProgress.phase = 'done';
  } finally {
    wikiRunning = false;
  }
});

/**
 * GET /api/import/wiki-scrape/status
 * Poll wiki scrape progress.
 */
importRouter.get('/wiki-scrape/status', (_req: Request, res: Response) => {
  res.json({
    running: wikiRunning,
    ...wikiProgress,
  });
});

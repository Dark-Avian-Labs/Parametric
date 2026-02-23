import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { importAllToCorpus } from '../db/corpus-import.js';
import { getCorpusDb } from '../db/corpus.js';

export const corpusRouter = Router();

corpusRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

const VALID_CATEGORIES: Record<string, string> = {
  warframes: 'corpus_warframes',
  weapons: 'corpus_weapons',
  sentinels: 'corpus_sentinels',
  upgrades: 'corpus_upgrades',
  relic_arcane: 'corpus_relic_arcane',
  manifest: 'corpus_manifest',
  customs: 'corpus_customs',
  drones: 'corpus_drones',
  flavour: 'corpus_flavour',
  fusion_bundles: 'corpus_fusion_bundles',
  gear: 'corpus_gear',
  keys: 'corpus_keys',
  recipes: 'corpus_recipes',
  regions: 'corpus_regions',
  resources: 'corpus_resources',
  sortie_rewards: 'corpus_sortie_rewards',
  intrinsics: 'corpus_intrinsics',
  other: 'corpus_other',
  mod_sets: 'corpus_mod_sets',
  avionics: 'corpus_avionics',
  focus_upgrades: 'corpus_focus_upgrades',
  abilities: 'corpus_abilities',
  railjack_weapons: 'corpus_railjack_weapons',
  nightwave: 'corpus_nightwave',
  railjack_nodes: 'corpus_railjack_nodes',
};

corpusRouter.get('/stats', (_req: Request, res: Response) => {
  try {
    const db = getCorpusDb();
    const stats: Record<string, number> = {};
    for (const [category, table] of Object.entries(VALID_CATEGORIES)) {
      try {
        const row = db
          .prepare(`SELECT COUNT(*) as count FROM ${table}`)
          .get() as { count: number };
        stats[category] = row.count;
      } catch {
        stats[category] = 0;
      }
    }
    res.json({ stats, total: Object.values(stats).reduce((a, b) => a + b, 0) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

corpusRouter.get('/search', (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(
      parseInt(String(req.query.limit || '50')) || 50,
      500,
    );
    const offset = parseInt(String(req.query.offset || '0')) || 0;
    const category =
      typeof req.query.category === 'string' ? req.query.category : undefined;

    if (!q) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const db = getCorpusDb();
    const pattern = `%${q}%`;

    if (category && VALID_CATEGORIES[category]) {
      const table = VALID_CATEGORIES[category];
      const rows = db
        .prepare(
          `SELECT unique_name, name, raw_json FROM ${table}
         WHERE name LIKE ? OR unique_name LIKE ?
         ORDER BY name LIMIT ? OFFSET ?`,
        )
        .all(pattern, pattern, limit, offset);

      const countRow = db
        .prepare(
          `SELECT COUNT(*) as total FROM ${table}
         WHERE name LIKE ? OR unique_name LIKE ?`,
        )
        .get(pattern, pattern) as { total: number };

      res.json({
        query: q,
        category,
        total: countRow.total,
        offset,
        limit,
        items: rows,
      });
    } else {
      const rows = db
        .prepare(
          `SELECT unique_name, name, category, raw_json FROM corpus_search
         WHERE name LIKE ? OR unique_name LIKE ?
         ORDER BY name LIMIT ? OFFSET ?`,
        )
        .all(pattern, pattern, limit, offset);

      res.json({ query: q, total: rows.length, offset, limit, items: rows });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

corpusRouter.get('/search-json', (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(
      parseInt(String(req.query.limit || '50')) || 50,
      200,
    );
    const category =
      typeof req.query.category === 'string' ? req.query.category : undefined;

    if (!q) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const db = getCorpusDb();
    const pattern = `%${q}%`;

    if (category && VALID_CATEGORIES[category]) {
      const table = VALID_CATEGORIES[category];
      const rows = db
        .prepare(
          `SELECT unique_name, name, raw_json FROM ${table}
         WHERE raw_json LIKE ?
         ORDER BY name LIMIT ?`,
        )
        .all(pattern, limit);

      res.json({ query: q, category, count: rows.length, items: rows });
    } else {
      const rows = db
        .prepare(
          `SELECT unique_name, name, category, raw_json FROM corpus_search
         WHERE raw_json LIKE ?
         ORDER BY name LIMIT ?`,
        )
        .all(pattern, limit);

      res.json({ query: q, count: rows.length, items: rows });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

corpusRouter.get('/lookup', (req: Request, res: Response) => {
  try {
    const category =
      typeof req.query.category === 'string' ? req.query.category : '';
    const uniqueName = typeof req.query.id === 'string' ? req.query.id : '';

    const table = VALID_CATEGORIES[category];
    if (!table) {
      res.status(400).json({ error: `Invalid category "${category}"` });
      return;
    }
    if (!uniqueName) {
      res.status(400).json({ error: 'Query parameter "id" is required' });
      return;
    }

    const db = getCorpusDb();
    const row = db
      .prepare(`SELECT * FROM ${table} WHERE unique_name = ?`)
      .get(uniqueName) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(row.raw_json as string);
    } catch {
      parsed = row.raw_json;
    }

    res.json({ ...row, raw_json: undefined, data: parsed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

corpusRouter.get('/xref', (req: Request, res: Response) => {
  try {
    const uniqueName = typeof req.query.id === 'string' ? req.query.id : '';
    if (!uniqueName) {
      res.status(400).json({ error: 'Query parameter "id" is required' });
      return;
    }

    const db = getCorpusDb();
    const results: Array<{
      category: string;
      unique_name: string;
      name: string | null;
    }> = [];

    const ID_BASED_TABLES = new Set([
      'corpus_nightwave',
      'corpus_railjack_nodes',
    ]);

    for (const [category, table] of Object.entries(VALID_CATEGORIES)) {
      const idCol = ID_BASED_TABLES.has(table) ? 'id' : 'unique_name';
      const rows = db
        .prepare(
          `SELECT ${idCol} AS unique_name, name FROM ${table} WHERE raw_json LIKE ?`,
        )
        .all(`%${uniqueName}%`) as Array<{
        unique_name: string;
        name: string | null;
      }>;

      for (const row of rows) {
        results.push({ category, ...row });
      }
    }

    res.json({
      query: uniqueName,
      references: results.length,
      items: results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

corpusRouter.post('/import', (_req: Request, res: Response) => {
  try {
    const results = importAllToCorpus();
    const totalImported = results.reduce((sum, r) => sum + r.count, 0);
    res.json({ success: true, total: totalImported, details: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

corpusRouter.get('/:category', (req: Request, res: Response) => {
  try {
    const category = req.params.category as string;
    const table = VALID_CATEGORIES[category];
    if (!table) {
      res.status(400).json({
        error: `Invalid category "${category}". Valid: ${Object.keys(VALID_CATEGORIES).join(', ')}`,
      });
      return;
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(
      parseInt(String(req.query.limit || '50')) || 50,
      500,
    );
    const offset = parseInt(String(req.query.offset || '0')) || 0;

    const db = getCorpusDb();

    if (q) {
      const pattern = `%${q}%`;
      const rows = db
        .prepare(
          `SELECT unique_name, name, raw_json FROM ${table}
         WHERE name LIKE ? OR unique_name LIKE ?
         ORDER BY name LIMIT ? OFFSET ?`,
        )
        .all(pattern, pattern, limit, offset);

      const countRow = db
        .prepare(
          `SELECT COUNT(*) as total FROM ${table}
         WHERE name LIKE ? OR unique_name LIKE ?`,
        )
        .get(pattern, pattern) as { total: number };

      res.json({ category, total: countRow.total, offset, limit, items: rows });
    } else {
      const rows = db
        .prepare(
          `SELECT unique_name, name, raw_json FROM ${table}
         ORDER BY name LIMIT ? OFFSET ?`,
        )
        .all(limit, offset);

      const countRow = db
        .prepare(`SELECT COUNT(*) as total FROM ${table}`)
        .get() as { total: number };

      res.json({ category, total: countRow.total, offset, limit, items: rows });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

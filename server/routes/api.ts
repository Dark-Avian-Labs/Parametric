import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { getDb } from '../db/connection.js';

export const apiRouter = Router();

apiRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'Parametric' });
});

apiRouter.get('/warframes', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM warframes ORDER BY name').all();
    res.json({ items: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

const WEAPON_JUNK_PREFIXES = [
  '/Lotus/Types/Friendly/Pets/CreaturePets/',
  '/Lotus/Types/Friendly/Pets/MoaPets/MoaPetParts/',
  '/Lotus/Types/Friendly/Pets/ZanukaPets/ZanukaPetParts/',
  '/Lotus/Types/Items/Deimos/',
  '/Lotus/Types/Vehicles/Hoverboard/',
];

apiRouter.get('/weapons', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const type =
      typeof req.query.type === 'string' ? req.query.type : undefined;

    let rows;
    if (type) {
      rows = db
        .prepare(
          'SELECT * FROM weapons WHERE product_category = ? ORDER BY name',
        )
        .all(type);
    } else {
      rows = db.prepare('SELECT * FROM weapons ORDER BY name').all();
    }

    const filtered = (rows as Array<{ unique_name: string }>).filter(
      (r) => !WEAPON_JUNK_PREFIXES.some((p) => r.unique_name.startsWith(p)),
    );

    res.json({ items: filtered });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.get('/companions', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM companions ORDER BY name').all();
    res.json({ items: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

const MOD_JUNK_SEGMENTS = ['/Beginner/', '/Intermediate/', '/Nemesis/'];
const MOD_JUNK_SUFFIXES = ['SubMod'];

apiRouter.get('/mods', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const typesRaw =
      typeof req.query.types === 'string' ? req.query.types : undefined;
    const typeRaw =
      typeof req.query.type === 'string' ? req.query.type : undefined;
    const rarity =
      typeof req.query.rarity === 'string' ? req.query.rarity : undefined;
    const search =
      typeof req.query.search === 'string' ? req.query.search : undefined;

    let sql = `SELECT m.*, ms.num_in_set AS set_num_in_set, ms.stats AS set_stats
      FROM mods m
      LEFT JOIN mod_sets ms ON m.mod_set = ms.unique_name
      WHERE 1=1`;
    const params: unknown[] = [];

    if (typesRaw) {
      const typeList = typesRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (typeList.length === 1) {
        sql += ' AND m.type = ?';
        params.push(typeList[0]);
      } else if (typeList.length > 1) {
        sql += ` AND m.type IN (${typeList.map(() => '?').join(',')})`;
        params.push(...typeList);
      }
    } else if (typeRaw) {
      sql += ' AND m.type = ?';
      params.push(typeRaw);
    }

    if (rarity) {
      sql += ' AND m.rarity = ?';
      params.push(rarity);
    }
    if (search) {
      sql += ' AND m.name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' ORDER BY m.name';

    const rows = db.prepare(sql).all(...params) as Array<{
      unique_name: string;
      name: string;
      type: string;
    }>;

    const cleaned = rows.filter((r) => {
      if (MOD_JUNK_SEGMENTS.some((seg) => r.unique_name.includes(seg)))
        return false;
      if (MOD_JUNK_SUFFIXES.some((suf) => r.unique_name.endsWith(suf)))
        return false;
      return true;
    });

    const byKey = new Map<string, (typeof cleaned)[number]>();
    for (const mod of cleaned) {
      const key = `${mod.name}|||${mod.type}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, mod);
      } else {
        const existingIsExpert = existing.unique_name.includes('/Expert/');
        const currentIsExpert = mod.unique_name.includes('/Expert/');
        if (existingIsExpert && !currentIsExpert) {
          byKey.set(key, mod);
        }
      }
    }

    res.json({ items: Array.from(byKey.values()) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.get('/mods/:uniqueName', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const uniqueName = String(req.params.uniqueName);
    const mod = db
      .prepare('SELECT * FROM mods WHERE unique_name = ?')
      .get(uniqueName);
    if (!mod) {
      res.status(404).json({ error: 'Mod not found' });
      return;
    }

    const levelStats = db
      .prepare(
        'SELECT * FROM mod_level_stats WHERE mod_unique_name = ? ORDER BY rank',
      )
      .all(uniqueName);

    res.json({ mod, levelStats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.get('/arcanes', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM arcanes WHERE unique_name NOT LIKE '%Sub' ORDER BY name",
      )
      .all();
    res.json({ items: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.get('/abilities', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const warframe =
      typeof req.query.warframe === 'string' ? req.query.warframe : undefined;
    const abilityNames =
      typeof req.query.ability_names === 'string'
        ? req.query.ability_names.split(',').filter(Boolean)
        : [];

    let rows;
    if (warframe || abilityNames.length > 0) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (warframe) {
        conditions.push('warframe_unique_name = ?');
        params.push(warframe);
      }
      if (abilityNames.length > 0) {
        conditions.push(
          `unique_name IN (${abilityNames.map(() => '?').join(',')})`,
        );
        params.push(...abilityNames);
      }
      rows = db
        .prepare(
          `SELECT * FROM abilities WHERE ${conditions.join(' OR ')} ORDER BY name`,
        )
        .all(...params);
    } else {
      rows = db.prepare('SELECT * FROM abilities ORDER BY name').all();
    }
    res.json({ items: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.get('/helminth-abilities', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        'SELECT * FROM abilities WHERE is_helminth_extractable = 1 ORDER BY name',
      )
      .all();
    res.json({ items: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.get('/riven-stats', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const weaponType =
      typeof req.query.weapon_type === 'string'
        ? req.query.weapon_type
        : undefined;

    let sql =
      "SELECT unique_name, name, compat_name, upgrade_entries FROM mods WHERE upgrade_entries IS NOT NULL AND upgrade_entries != ''";
    const params: string[] = [];

    if (weaponType) {
      sql += ' AND type = ?';
      params.push(weaponType);
    }

    sql += ' ORDER BY name';
    const rows = db.prepare(sql).all(...params);
    res.json({ items: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.get('/archon-shards', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const types = db
      .prepare('SELECT * FROM archon_shard_types ORDER BY sort_order')
      .all() as Array<Record<string, unknown>>;
    const buffs = db
      .prepare('SELECT * FROM archon_shard_buffs ORDER BY sort_order')
      .all() as Array<Record<string, unknown>>;

    const result = types.map((t) => ({
      ...t,
      buffs: buffs.filter((b) => b.shard_type_id === t.id),
    }));

    res.json({ shards: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.put('/archon-shards/types/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, icon_path, tauforged_icon_path, sort_order } = req.body;
    db.prepare(
      'UPDATE archon_shard_types SET name = ?, icon_path = ?, tauforged_icon_path = ?, sort_order = ? WHERE id = ?',
    ).run(name, icon_path, tauforged_icon_path, sort_order, req.params.id);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/archon-shards/types', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id, name, icon_path, tauforged_icon_path, sort_order } = req.body;
    db.prepare(
      'INSERT INTO archon_shard_types (id, name, icon_path, tauforged_icon_path, sort_order) VALUES (?, ?, ?, ?, ?)',
    ).run(id, name, icon_path, tauforged_icon_path, sort_order || 0);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/archon-shards/buffs', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const {
      shard_type_id,
      description,
      base_value,
      tauforged_value,
      value_format,
      sort_order,
    } = req.body;
    const result = db
      .prepare(
        'INSERT INTO archon_shard_buffs (shard_type_id, description, base_value, tauforged_value, value_format, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        shard_type_id,
        description,
        base_value,
        tauforged_value,
        value_format || '%',
        sort_order || 0,
      );
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.put('/archon-shards/buffs/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const {
      description,
      base_value,
      tauforged_value,
      value_format,
      sort_order,
    } = req.body;
    db.prepare(
      'UPDATE archon_shard_buffs SET description = ?, base_value = ?, tauforged_value = ?, value_format = ?, sort_order = ? WHERE id = ?',
    ).run(
      description,
      base_value,
      tauforged_value,
      value_format,
      sort_order,
      req.params.id,
    );
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.delete('/archon-shards/buffs/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM archon_shard_buffs WHERE id = ?').run(
      req.params.id,
    );
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.get('/loadouts', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const loadouts = db
      .prepare(
        'SELECT * FROM loadouts WHERE user_id = ? ORDER BY updated_at DESC',
      )
      .all(req.session.user_id) as Array<Record<string, unknown>>;
    for (const l of loadouts) {
      (l as Record<string, unknown>).builds = db
        .prepare('SELECT * FROM loadout_builds WHERE loadout_id = ?')
        .all(l.id);
    }
    res.json({ loadouts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/loadouts', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { name } = req.body;
    const result = db
      .prepare('INSERT INTO loadouts (user_id, name) VALUES (?, ?)')
      .run(req.session.user_id, name);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.put('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { name } = req.body;
    db.prepare(
      "UPDATE loadouts SET name = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
    ).run(name, req.params.id, req.session.user_id);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.delete('/loadouts/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    db.prepare('DELETE FROM loadout_builds WHERE loadout_id = ?').run(
      req.params.id,
    );
    db.prepare('DELETE FROM loadouts WHERE id = ? AND user_id = ?').run(
      req.params.id,
      req.session.user_id,
    );
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/loadouts/:id/builds', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { build_id, slot_type } = req.body;
    db.prepare(
      'INSERT OR REPLACE INTO loadout_builds (loadout_id, build_id, slot_type) VALUES (?, ?, ?)',
    ).run(req.params.id, build_id, slot_type);
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.delete(
  '/loadouts/:id/builds/:slotType',
  (req: Request, res: Response) => {
    try {
      const db = getDb();
      db.prepare(
        'DELETE FROM loadout_builds WHERE loadout_id = ? AND slot_type = ?',
      ).run(req.params.id, req.params.slotType);
      res.json({ success: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    }
  },
);

apiRouter.get('/builds', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const rows = db
      .prepare(
        'SELECT * FROM builds WHERE user_id = ? ORDER BY updated_at DESC',
      )
      .all(req.session.user_id);
    res.json({ builds: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/builds', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { name, equipment_type, equipment_unique_name, mod_config } =
      req.body;

    const result = db
      .prepare(
        `INSERT INTO builds (user_id, name, equipment_type, equipment_unique_name, mod_config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(
        req.session.user_id,
        name,
        equipment_type,
        equipment_unique_name,
        JSON.stringify(mod_config),
      );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.put('/builds/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const id = String(req.params.id);
    const { name, mod_config } = req.body;

    db.prepare(
      `UPDATE builds SET name = ?, mod_config = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    ).run(name, JSON.stringify(mod_config), id, req.session.user_id);

    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.delete('/builds/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!req.session.user_id) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const id = String(req.params.id);
    db.prepare('DELETE FROM builds WHERE id = ? AND user_id = ?').run(
      id,
      req.session.user_id,
    );
    res.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

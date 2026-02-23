import Database from 'better-sqlite3';

import { DB_PATH, CENTRAL_DB_PATH } from '../config.js';
import { closeCorpusDb } from './corpus.js';

let db: Database.Database | null = null;
let centralDb: Database.Database | null = null;

/**
 * Get the main application database (parametric.db).
 */
export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Get the central user database (central.db).
 */
export function getCentralDb(): Database.Database {
  if (!centralDb) {
    centralDb = new Database(CENTRAL_DB_PATH);
    centralDb.pragma('journal_mode = WAL');
    centralDb.pragma('foreign_keys = ON');
  }
  return centralDb;
}

/**
 * Close all database connections (for clean shutdown).
 */
export function closeAll(): void {
  if (db) {
    db.close();
    db = null;
  }
  if (centralDb) {
    centralDb.close();
    centralDb = null;
  }
  closeCorpusDb();
}

process.on('SIGINT', () => {
  closeAll();
  process.exit(0); // eslint-disable-line n/no-process-exit
});
process.on('SIGTERM', () => {
  closeAll();
  process.exit(0); // eslint-disable-line n/no-process-exit
});

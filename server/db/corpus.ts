import Database from 'better-sqlite3';

import { CORPUS_DB_PATH } from '../config.js';
import { createCorpusSchema } from './corpus-schema.js';

let corpusDb: Database.Database | null = null;

/**
 * Get the corpus database (corpus.db).
 * Initializes and creates schema on first access.
 */
export function getCorpusDb(): Database.Database {
  if (!corpusDb) {
    corpusDb = new Database(CORPUS_DB_PATH);
    corpusDb.pragma('journal_mode = WAL');
    corpusDb.pragma('foreign_keys = ON');
    createCorpusSchema(corpusDb);
  }
  return corpusDb;
}

/**
 * Close the corpus database connection.
 */
export function closeCorpusDb(): void {
  if (corpusDb) {
    corpusDb.close();
    corpusDb = null;
  }
}

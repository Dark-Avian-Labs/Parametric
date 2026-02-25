import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const parentName = path.basename(path.resolve(__dirname, '..'));
export const PROJECT_ROOT = path.resolve(
  __dirname,
  parentName === 'dist' ? '../..' : '..',
);
export const DATA_DIR = path.join(PROJECT_ROOT, 'data');
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
export const IMAGES_DIR = path.join(DATA_DIR, 'images');
export const DB_PATH = path.join(DATA_DIR, 'parametric.db');
export const CORPUS_DB_PATH = path.join(DATA_DIR, 'corpus.db');
export const CENTRAL_DB_PATH =
  process.env.CENTRAL_DB_PATH || path.join(DATA_DIR, 'central.db');
export const AUTH_LOCKOUT_FILE = path.join(DATA_DIR, 'auth-lockout.json');

const _port = parseInt(process.env.PORT || '3001', 10);
export const PORT = Number.isFinite(_port) && _port > 0 ? _port : 3001;
export const HOST = process.env.HOST || '127.0.0.1';
const DEFAULT_SESSION_SECRET = 'parametric-dev-secret-change-me';
export const SESSION_SECRET =
  process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
export const NODE_ENV = process.env.NODE_ENV || 'development';

if (NODE_ENV === 'production' && SESSION_SECRET === DEFAULT_SESSION_SECRET) {
  console.error(
    '[FATAL] SESSION_SECRET must be set in production. Refusing to start with the default secret.',
  );
  process.exit(1); // eslint-disable-line n/no-process-exit
}

export const APP_NAME = 'Parametric';

export const MANIFEST_URL =
  'https://origin.warframe.com/PublicExport/index_en.txt.lzma';
export const CONTENT_BASE_URL =
  'https://content.warframe.com/PublicExport/Manifest/';
export const IMAGE_BASE_URL = 'https://content.warframe.com/PublicExport';

export const REQUIRED_EXPORTS = [
  'ExportCustoms',
  'ExportDrones',
  'ExportFlavour',
  'ExportFusionBundles',
  'ExportGear',
  'ExportKeys',
  'ExportManifest',
  'ExportRecipes',
  'ExportRegions',
  'ExportRelicArcane',
  'ExportResources',
  'ExportSentinels',
  'ExportSortieRewards',
  'ExportUpgrades',
  'ExportWarframes',
  'ExportWeapons',
] as const;

const _authMaxAttempts = parseInt(process.env.AUTH_MAX_ATTEMPTS || '5', 10);
export const AUTH_MAX_ATTEMPTS =
  Number.isFinite(_authMaxAttempts) && _authMaxAttempts > 0
    ? _authMaxAttempts
    : 5;

const _authLockoutMinutes = parseInt(
  process.env.AUTH_LOCKOUT_MINUTES || '15',
  10,
);
export const AUTH_LOCKOUT_MINUTES =
  Number.isFinite(_authLockoutMinutes) && _authLockoutMinutes > 0
    ? _authLockoutMinutes
    : 15;

const _authAttemptWindowMinutes = parseInt(
  process.env.AUTH_ATTEMPT_WINDOW_MINUTES || '15',
  10,
);
export const AUTH_ATTEMPT_WINDOW_MINUTES =
  Number.isFinite(_authAttemptWindowMinutes) && _authAttemptWindowMinutes > 0
    ? _authAttemptWindowMinutes
    : 15;
export const AUTH_ATTEMPT_WINDOW_SECONDS = AUTH_ATTEMPT_WINDOW_MINUTES * 60;

export const TRUST_PROXY =
  process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true';
export const SECURE_COOKIES =
  process.env.SECURE_COOKIES === '1' || process.env.SECURE_COOKIES === 'true';
export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
export const GAME_ID = 'parametric';

export function ensureDataDirs(): void {
  for (const dir of [DATA_DIR, EXPORTS_DIR, IMAGES_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

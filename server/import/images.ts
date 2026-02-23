import fs from 'fs';
import path from 'path';

import { IMAGE_BASE_URL, IMAGES_DIR, EXPORTS_DIR } from '../config.js';
import { getDb } from '../db/connection.js';

export interface ImageDownloadResult {
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface ManifestImageEntry {
  uniqueName: string;
  textureLocation: string;
}

/** How many images to download in parallel */
const CONCURRENCY = 15;

/**
 * Collect unique_names from all DB tables that have an image_path column.
 * These are the only items we want images for.
 */
export function collectDbUniqueNames(): Set<string> {
  const db = getDb();
  const names = new Set<string>();

  const tables = [
    'warframes',
    'weapons',
    'companions',
    'mods',
    'arcanes',
    'abilities',
  ];
  for (const table of tables) {
    const rows = db.prepare(`SELECT unique_name FROM ${table}`).all() as {
      unique_name: string;
    }[];
    for (const row of rows) {
      names.add(row.unique_name);
    }
  }

  return names;
}

/**
 * Build the manifest lookup: uniqueName → textureLocation.
 */
function loadManifest(): Map<string, ManifestImageEntry> {
  let manifestPath = path.join(EXPORTS_DIR, 'ExportManifest.json');
  if (!fs.existsSync(manifestPath)) {
    manifestPath = path.join(EXPORTS_DIR, 'ExportManifest_en.json');
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error('ExportManifest not found. Run the import pipeline first.');
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const entries: ManifestImageEntry[] = raw.Manifest || [];

  const map = new Map<string, ManifestImageEntry>();
  for (const entry of entries) {
    map.set(entry.uniqueName, entry);
  }
  return map;
}

/**
 * For a given manifest entry, compute the local file path and the hash.
 */
function getImagePaths(entry: ManifestImageEntry): {
  /** Full local file path, e.g. data/images/Lotus/Upgrades/Mods/.../Foo.png */
  localPath: string;
  /** Directory to create */
  localDir: string;
  /** The hash part after the ! in textureLocation */
  hash: string;
  /** Path to the .hash sidecar file */
  hashPath: string;
  /** The image_path to store in the DB (relative, for serving via /images/...) */
  dbImagePath: string;
  /** Extension (e.g. .png) */
  ext: string;
} {
  const { textureLocation, uniqueName } = entry;

  // Extract hash from texture location (after the !)
  const bangIndex = textureLocation.indexOf('!');
  const hash = bangIndex !== -1 ? textureLocation.substring(bangIndex + 1) : '';

  // Build local path from uniqueName
  const safeName = uniqueName.replace(/^\//, '').replace(/[<>:"|?*]/g, '_');
  const ext = path.extname(textureLocation.split('!')[0]) || '.png';
  const localPath = path.join(IMAGES_DIR, safeName + ext);
  const localDir = path.dirname(localPath);
  const hashPath = `${localPath}.hash`;

  // The path we store in the DB — relative from the images root, with leading /
  const dbImagePath = `/${safeName.replace(/\\/g, '/')}${ext}`;

  return { localPath, localDir, hash, hashPath, dbImagePath, ext };
}

/**
 * Download a single image. Returns the dbImagePath on success, null on skip/fail.
 */
async function downloadSingleImage(
  entry: ManifestImageEntry,
): Promise<
  { dbImagePath: string; status: 'downloaded' | 'skipped' } | { error: string }
> {
  const { textureLocation } = entry;
  const { localPath, localDir, hash, hashPath, dbImagePath } =
    getImagePaths(entry);

  // Check cache: if file + hash match, skip
  if (hash && fs.existsSync(localPath) && fs.existsSync(hashPath)) {
    const existingHash = fs.readFileSync(hashPath, 'utf-8').trim();
    if (existingHash === hash) {
      return { dbImagePath, status: 'skipped' };
    }
  }

  // Download
  const url = `${IMAGE_BASE_URL}${textureLocation}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Ensure directory exists
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    fs.writeFileSync(localPath, buffer);
    if (hash) {
      fs.writeFileSync(hashPath, hash, 'utf-8');
    }

    return { dbImagePath, status: 'downloaded' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `${entry.uniqueName}: ${msg}` };
  }
}

/**
 * Download images for items in the database, with concurrent downloads
 * and hash-based caching. Updates the DB image_path column afterwards.
 */
export async function downloadImages(
  onProgress?: (completed: number, total: number, latest: string) => void,
): Promise<ImageDownloadResult> {
  // 1. Get the unique names we need from the DB
  const dbNames = collectDbUniqueNames();

  // 2. Load the manifest and filter to only our items
  const manifest = loadManifest();
  const toDownload: ManifestImageEntry[] = [];
  for (const name of dbNames) {
    const entry = manifest.get(name);
    if (entry && entry.textureLocation) {
      toDownload.push(entry);
    }
  }

  const result: ImageDownloadResult = {
    total: toDownload.length,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // 3. Download in batches with concurrency
  // Map: uniqueName → dbImagePath (for DB update)
  const imagePathMap = new Map<string, string>();
  let completed = 0;

  for (let i = 0; i < toDownload.length; i += CONCURRENCY) {
    const batch = toDownload.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((entry) => downloadSingleImage(entry)),
    );

    for (let j = 0; j < results.length; j++) {
      const res = results[j];
      const entry = batch[j];
      completed++;

      if ('error' in res) {
        result.failed++;
        result.errors.push(res.error);
      } else {
        imagePathMap.set(entry.uniqueName, res.dbImagePath);
        if (res.status === 'downloaded') {
          result.downloaded++;
        } else {
          result.skipped++;
        }
      }
    }

    onProgress?.(
      completed,
      toDownload.length,
      batch[batch.length - 1]?.uniqueName || '',
    );
  }

  // 4. Bulk-update image_path in all DB tables
  updateDbImagePaths(imagePathMap);

  return result;
}

/**
 * Update the image_path column in all relevant DB tables.
 */
function updateDbImagePaths(pathMap: Map<string, string>): void {
  const db = getDb();
  const tables = [
    'warframes',
    'weapons',
    'companions',
    'mods',
    'arcanes',
    'abilities',
  ];

  const stmts = tables.map((table) =>
    db.prepare(`UPDATE ${table} SET image_path = ? WHERE unique_name = ?`),
  );

  const tx = db.transaction(() => {
    for (const [uniqueName, imagePath] of pathMap) {
      for (const stmt of stmts) {
        stmt.run(imagePath, uniqueName);
      }
    }
  });

  tx();
  console.log(`[Images] Updated image_path for ${pathMap.size} items in DB`);
}

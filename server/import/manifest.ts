import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

import { MANIFEST_URL, EXPORTS_DIR } from '../config.js';

// The 'lzma' package is CJS-only, use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
const { LZMA } = require('lzma');
const lzmaWorker = LZMA();

export interface ManifestEntry {
  /** e.g. "ExportSentinels_en" */
  category: string;
  /** e.g. "ExportSentinels_en.json!00_abc123" */
  fullFilename: string;
  /** e.g. "00_abc123" */
  hash: string;
}

/**
 * Download the LZMA-compressed manifest, decompress it, and parse the entries.
 * Each line has the format: ExportCategory_en.json!HASH_VALUE
 */
export async function downloadAndParseManifest(): Promise<ManifestEntry[]> {
  console.log(`[Import] Downloading manifest from ${MANIFEST_URL}`);

  const response = await fetch(MANIFEST_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download manifest: ${response.status} ${response.statusText}`,
    );
  }

  const compressedBuffer = Buffer.from(await response.arrayBuffer());
  console.log(
    `[Import] Downloaded ${compressedBuffer.length} bytes, decompressing...`,
  );

  const text = await decompressLzma(compressedBuffer);

  // Save raw manifest for reference
  const manifestPath = path.join(EXPORTS_DIR, 'manifest.txt');
  fs.writeFileSync(manifestPath, text, 'utf-8');
  console.log(`[Import] Manifest saved to ${manifestPath}`);

  return parseManifestText(text);
}

/**
 * Decompress an LZMA buffer using the pure-JS lzma package.
 * The Warframe manifest uses LZMA alone format (.lzma), not XZ.
 */
function decompressLzma(compressed: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const byteArray = Array.from(compressed);
    lzmaWorker.decompress(
      byteArray,
      (result: string | null, error?: Error | string) => {
        if (error) {
          reject(typeof error === 'string' ? new Error(error) : error);
        } else if (result !== null) {
          resolve(result);
        } else {
          reject(new Error('LZMA decompression returned null'));
        }
      },
    );
  });
}

/**
 * Parse the manifest text into structured entries.
 * Each non-empty line: ExportCategory_en.json!HASH_VALUE
 */
export function parseManifestText(text: string): ManifestEntry[] {
  const entries: ManifestEntry[] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const bangIndex = trimmed.indexOf('!');
    if (bangIndex === -1) continue;

    const filename = trimmed.substring(0, bangIndex);
    const hash = trimmed.substring(bangIndex + 1);

    // Extract category name: "ExportSentinels_en.json" -> "ExportSentinels_en"
    const dotIndex = filename.indexOf('.');
    const category =
      dotIndex !== -1 ? filename.substring(0, dotIndex) : filename;

    entries.push({
      category,
      fullFilename: trimmed,
      hash,
    });
  }

  console.log(`[Import] Parsed ${entries.length} manifest entries`);
  return entries;
}

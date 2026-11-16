import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

import { getAdminClient, log, logSection, logSuccess } from './config';
import type { SeedActivity } from './phaser-catalog';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.txt': 'text/plain',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

export const ACTIVITY_HOST_STORAGE_PREFIX = 'activity-host';
const ACTIVITY_HOST_PUBLIC_BASE = `/api/v1/renderer-proxy/activity-renderers/${ACTIVITY_HOST_STORAGE_PREFIX}/`;

export interface ActivityHostUpload {
  filePath: string;
  storagePath: string;
}

export async function syncActivityRenderers(
  activities: readonly SeedActivity[],
  options: { phaserRoot: string; build: boolean },
): Promise<void> {
  if (!activities.length) return;

  logSection('Syncing single Activity renderer host...');
  const client = getAdminClient();
  const { error: bucketError } = await client.storage.createBucket('activity-renderers', { public: true });
  if (bucketError && !bucketError.message.includes('already exists')) {
    throw new Error(`Failed to create activity-renderers bucket: ${bucketError.message}`);
  }

  if (options.build) {
    log('Building game-core Activity host');
    execSync(getActivityHostBuildCommand(), {
      cwd: options.phaserRoot,
      stdio: 'inherit',
    });
  }

  const uploads = collectActivityHostUploads(options.phaserRoot);
  for (const upload of uploads) {
    const { error } = await client.storage
      .from('activity-renderers')
      .upload(upload.storagePath, fs.readFileSync(upload.filePath), {
        contentType: contentType(upload.filePath),
        upsert: true,
      });
    if (error) {
      throw new Error(`Failed to upload renderer asset ${upload.storagePath}: ${error.message}`);
    }
  }

  logSuccess(`Activity host synced (${uploads.length} files)`);
}

export function getActivityHostBuildCommand(): string {
  return `npm --prefix packages/game-core run build:host -- --base ${ACTIVITY_HOST_PUBLIC_BASE}`;
}

export function collectActivityHostUploads(phaserRoot: string): ActivityHostUpload[] {
  const distDir = activityHostDistDir(phaserRoot);
  if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
    throw new Error(`Missing Activity host build: ${distDir}`);
  }

  const files = walkDir(distDir).sort();
  if (!files.length) {
    throw new Error(`Activity host build is empty: ${distDir}`);
  }

  return files.map((filePath) => ({
    filePath,
    storagePath: `${ACTIVITY_HOST_STORAGE_PREFIX}/${path.relative(distDir, filePath).replace(/\\/g, '/')}`,
  }));
}

function activityHostDistDir(phaserRoot: string): string {
  return path.join(phaserRoot, 'packages', 'game-core', 'dist', 'activity-host');
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(fullPath));
    else if (entry.isFile()) results.push(fullPath);
  }
  return results;
}

function contentType(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

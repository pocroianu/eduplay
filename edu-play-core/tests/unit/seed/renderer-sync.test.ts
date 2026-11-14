import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_HOST_STORAGE_PREFIX,
  collectActivityHostUploads,
  getActivityHostBuildCommand,
} from '../../../scripts/seed/renderer-sync';

describe('renderer sync planning', () => {
  it('builds and uploads the single game-core activity host instead of per-template bundles', () => {
    const phaserRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phaser-host-'));
    const distRoot = path.join(phaserRoot, 'packages/game-core/dist/activity-host');
    fs.mkdirSync(path.join(distRoot, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(distRoot, 'index.html'), '<script type="module" src="./assets/app.js"></script>');
    fs.writeFileSync(path.join(distRoot, 'assets/app.js'), 'export {};');

    expect(getActivityHostBuildCommand()).toBe(
      'npm run build:host --workspace=@edu-play/game-core -- --base /api/v1/renderer-proxy/activity-renderers/activity-host/',
    );
    expect(collectActivityHostUploads(phaserRoot).map((upload) => upload.storagePath)).toEqual([
      `${ACTIVITY_HOST_STORAGE_PREFIX}/assets/app.js`,
      `${ACTIVITY_HOST_STORAGE_PREFIX}/index.html`,
    ]);
  });
});

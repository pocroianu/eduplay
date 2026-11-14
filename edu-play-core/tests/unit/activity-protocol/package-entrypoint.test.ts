import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..', '..');


describe('activity protocol package entrypoint', () => {
  it('builds a native ESM entrypoint that Node can import', async () => {
    execSync('npm run build:activity-protocol', {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });

    const emittedIndex = readFileSync(
      join(REPO_ROOT, 'packages/activity-protocol/dist/index.js'),
      'utf8',
    );
    expect(emittedIndex).toContain("export * from './messages.js';");

    const mod = await import(
      pathToFileURL(
        join(REPO_ROOT, 'packages/activity-protocol/dist/index.js'),
      ).href,
    );

    expect(
      mod.gameToHostMessageSchema.parse({
        type: 'GAME_COMPLETE',
        score: 80,
        totalSets: 10,
        timeSpent: 45,
      }),
    ).toEqual({
      type: 'GAME_COMPLETE',
      score: 80,
      totalSets: 10,
      timeSpent: 45,
    });
  }, 30_000);
});

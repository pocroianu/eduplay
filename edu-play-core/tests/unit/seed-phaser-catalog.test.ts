import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { seedUuid } from '../../scripts/seed/ids';
import { getTierSelection, loadSeedActivities } from '../../scripts/seed/phaser-catalog';

describe('Phaser Activity seed catalog', () => {
  it('uses deterministic UUIDs for stable natural keys', () => {
    expect(seedUuid('baseline:activity:multiple-choice:fruits-01')).toBe(
      seedUuid('baseline:activity:multiple-choice:fruits-01'),
    );
    expect(seedUuid('baseline:activity:multiple-choice:fruits-01')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('selects one representative Activity per renderer template for medium', () => {
    expect(getTierSelection('medium')).toEqual([
      { template: 'multiple-choice', sourceActivityId: 'fruits-01' },
      { template: 'matching-game', sourceActivityId: 'animals-match-01' },
      { template: 'categorize-game', sourceActivityId: 'animals-habitat-01' },
      { template: 'sequence-order', sourceActivityId: 'numbers-1-to-6' },
      { template: 'memory-game', sourceActivityId: 'animals-memory-01' },
      { template: 'tracing-game', sourceActivityId: 'uppercase-a-to-f' },
      { template: 'counting-game', sourceActivityId: 'farm-count-01' },
      { template: 'pattern-game', sourceActivityId: 'shapes-pattern-01' },
      { template: 'repeat-sequence', sourceActivityId: 'colours-sequence-01' },
      { template: 'listen-tap', sourceActivityId: 'phonics-ro-01' },
    ]);
  });

  it('loads selected Phaser Activity configs from a checkout-shaped fixture', () => {
    const phaserRoot = createPhaserFixture();

    const activities = loadSeedActivities('minimal', { phaserRoot });

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      typeId: 'multiple-choice',
      sourceActivityId: 'fruits-01',
      title: 'Test Fructe și Obiecte',
      versionId: expect.any(String),
      schemaVersion: 1,
    });
    expect(activities[0].tags).toContain('seed:baseline');
  });

  it('rejects a config whose game type does not match the selected Renderer Template', () => {
    const phaserRoot = createPhaserFixture({ configGameType: 'matching' });

    expect(() => loadSeedActivities('minimal', { phaserRoot })).toThrow(/renderer mismatch/);
  });
});

function createPhaserFixture(options: { configGameType?: string } = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eduplay-phaser-seed-'));

  writeJson(path.join(root, 'renderers/multiple-choice/renderer.json'), {
    rendererId: 'multiple-choice',
    version: '1.0.0',
    defaultGameId: 'fruits-01',
    entry: 'src/template.ts',
    configGameType: 'multipleChoice',
  });
  writeJson(path.join(root, 'activities/fruits-01/activity.json'), {
    activityId: 'fruits-01',
    version: 1,
    renderer: { id: 'multiple-choice', version: '^1.0.0' },
    gameId: 'fruits-01',
  });
  writeJson(path.join(root, 'activities/fruits-01/versions/1/config.json'), {
    meta: {
      gameId: 'fruits-01',
      gameType: options.configGameType ?? 'multipleChoice',
      version: '1.0.0',
      totalSteps: 1,
    },
    questions: [{ id: 'q1', choices: [] }],
  });
  writeJson(path.join(root, 'activities/fruits-01/versions/1/strings/ro.json'), {
    meta: {
      title: 'Test Fructe și Obiecte',
      description: 'Descriere',
    },
  });
  writeValidationStub(root);
  return root;
}

function writeValidationStub(root: string): void {
  const filePath = path.join(root, 'packages/validation/dist/index.js');
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    'exports.parseGameConfig = function parseGameConfig() { return { success: true }; };',
    'utf-8',
  );
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
}

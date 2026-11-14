import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { loadSeedActivities } from '../../../scripts/seed/phaser-catalog';

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

describe('loadSeedActivities', () => {
  it('loads the baseline activity package from the single-host phaser activities directory', () => {
    const phaserRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phaser-seed-'));

    writeJson(path.join(phaserRoot, 'renderers/multiple-choice/renderer.json'), {
      rendererId: 'multiple-choice',
      version: '1.0.0',
      defaultGameId: 'fruits-01',
      entry: 'src/template.ts',
      configGameType: 'multipleChoice',
    });
    fs.mkdirSync(path.join(phaserRoot, 'packages/validation/dist'), { recursive: true });
    fs.writeFileSync(
      path.join(phaserRoot, 'packages/validation/dist/index.js'),
      'exports.parseGameConfig = (data) => ({ success: true, data });\n',
    );

    writeJson(path.join(phaserRoot, 'activities/fruits-01/activity.json'), {
      activityId: 'fruits-01',
      version: 1,
      renderer: { id: 'multiple-choice', version: '^1.0.0' },
      gameId: 'fruits-01',
    });
    writeJson(path.join(phaserRoot, 'activities/fruits-01/versions/1/config.json'), {
      meta: {
        gameId: 'fruits-01',
        gameType: 'multipleChoice',
        difficulty: 'easy',
        totalSteps: 3,
      },
    });
    writeJson(path.join(phaserRoot, 'activities/fruits-01/versions/1/strings/ro.json'), {
      meta: {
        title: 'Test Fructe și Obiecte',
        description: 'Învață să identifici fructe, animale și obiecte.',
      },
    });

    const [activity] = loadSeedActivities('minimal', { phaserRoot });

    expect(activity).toMatchObject({
      typeId: 'multiple-choice',
      rendererKey: 'activity-host',
      sourceActivityId: 'fruits-01',
      title: 'Test Fructe și Obiecte',
      description: 'Învață să identifici fructe, animale și obiecte.',
      questionCount: 3,
      configData: {
        meta: {
          gameId: 'fruits-01',
          gameType: 'multipleChoice',
          difficulty: 'easy',
          totalSteps: 3,
        },
      },
    });
    expect(activity.configPath.replace(/\\/g, '/')).toContain(
      'activities/fruits-01/versions/1/config.json',
    );
  });
});

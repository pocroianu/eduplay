import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  activityMetadataSchema,
  activityAssetRegistrySchema,
  validateActivityAssetPins
} from '../src';

const repoRoot = resolve(__dirname, '../../..');
const activitiesRoot = join(repoRoot, 'activities');

describe('Activity file schemas', () => {
  it('validates every checked-in activity.json and Activity-version assets.json', () => {
    const failures: string[] = [];

    for (const entry of readdirSync(activitiesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const activityPath = join(activitiesRoot, entry.name, 'activity.json');
      const activityResult = activityMetadataSchema.safeParse(readJson(activityPath));
      if (!activityResult.success) {
        failures.push(`${entry.name}/activity.json: ${activityResult.error.message}`);
        continue;
      }

      const versionRoot = join(activitiesRoot, entry.name, 'versions', String(activityResult.data.version));
      const assetsPath = join(versionRoot, 'assets.json');
      if (!existsSync(assetsPath)) {
        failures.push(`${entry.name}@${activityResult.data.version}: missing assets.json`);
        continue;
      }

      const assetsResult = activityAssetRegistrySchema.safeParse(readJson(assetsPath));
      if (!assetsResult.success) {
        failures.push(`${entry.name}@${activityResult.data.version}/assets.json: ${assetsResult.error.message}`);
        continue;
      }

      const pinResult = validateActivityAssetPins(assetsResult.data, activityResult.data.gameId);
      if (!pinResult.success) {
        failures.push(`${entry.name}@${activityResult.data.version}/assets.json: ${pinResult.errors.join('; ')}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('rejects Activity metadata without a stable version or renderer compatibility range', () => {
    expect(activityMetadataSchema.safeParse({
      activityId: 'bad-activity',
      version: 'latest',
      renderer: { id: 'multiple-choice', version: 'latest' },
      gameId: 'bad-activity'
    }).success).toBe(false);
  });

  it('accepts pruned Activity manifests with semantically named library-pinned assets', () => {
    const result = activityAssetRegistrySchema.safeParse({
      version: '2.0.0',
      baseUrl: 'assets',
      pinnedAssets: {
        apple: imagePin('0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28')
      },
      games: {
        'fruits-01': {
          manifest: { images: ['apple'], audio: [], spritesheets: [] }
        }
      }
    });

    expect(result.success).toBe(true);
  });

  it('rejects pins whose type does not match the semantic library path', () => {
    const sha256 = '0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28';

    expect(activityAssetRegistrySchema.safeParse({
      version: '2.0.0',
      baseUrl: 'assets',
      pinnedAssets: {
        apple: {
          type: 'image',
          assetId: `sha256-${sha256}`,
          sha256,
          path: `/assets/library/audio/apple.mp3`
        }
      },
      games: {
        'fruits-01': {
          manifest: { images: ['apple'], audio: [], spritesheets: [] }
        }
      }
    }).success).toBe(false);

    expect(activityAssetRegistrySchema.safeParse({
      version: '2.0.0',
      baseUrl: 'assets',
      pinnedAssets: {
        question1: {
          type: 'audio',
          assetId: `sha256-${sha256}`,
          sha256,
          path: `/assets/library/images/question1.png`
        }
      },
      games: {
        'fruits-01': {
          manifest: { images: [], audio: ['question1'], spritesheets: [] }
        }
      }
    }).success).toBe(false);
  });

  it('rejects hash-named pinned asset paths', () => {
    const sha256 = '0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28';

    expect(activityAssetRegistrySchema.safeParse({
      version: '2.0.0',
      baseUrl: 'assets',
      pinnedAssets: {
        apple: {
          type: 'image',
          assetId: `sha256-${sha256}`,
          sha256,
          path: `/assets/library/images/sha256-${sha256}.png`
        }
      },
      games: {
        'fruits-01': {
          manifest: { images: ['apple'], audio: [], spritesheets: [] }
        }
      }
    }).success).toBe(false);
  });

  it('rejects selected game pins that point at a different semantic filename', () => {
    const result = activityAssetRegistrySchema.parse({
      version: '2.0.0',
      baseUrl: 'assets',
      pinnedAssets: {
        apple: imagePin('banana', '0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28')
      },
      games: {
        'fruits-01': {
          manifest: { images: ['apple'], audio: [], spritesheets: [] }
        }
      }
    });

    expect(validateActivityAssetPins(result, 'fruits-01')).toEqual({
      success: false,
      errors: [
        'pinnedAssets.apple points at /assets/library/images/banana.png, expected semantic filename apple'
      ]
    });
  });

  it('rejects any Activity pin whose semantic filename does not match its key', () => {
    const result = activityAssetRegistrySchema.parse({
      version: '2.0.0',
      baseUrl: 'assets',
      pinnedAssets: {
        apple: imagePin('apple', '0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28'),
        staleBanana: imagePin('banana', '0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28')
      },
      games: {
        'fruits-01': {
          manifest: { images: ['apple'], audio: [], spritesheets: [] }
        }
      }
    });

    expect(validateActivityAssetPins(result, 'fruits-01')).toEqual({
      success: false,
      errors: [
        'pinnedAssets.staleBanana points at /assets/library/images/banana.png, expected semantic filename staleBanana'
      ]
    });
  });

  it('rejects selected game asset keys without matching immutable pins', () => {
    const result = activityAssetRegistrySchema.parse({
      version: '2.0.0',
      baseUrl: 'assets',
      pinnedAssets: {
        apple: imagePin('apple', '0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28'),
        question1: imagePin('question1', '0a827d9b4661d0a949ed5edd796de47170fdc3e1923aee592e70c40de2a29f28')
      },
      sharedGroups: {
        'core-mascots': { images: ['guapen'], audio: [], spritesheets: [] }
      },
      games: {
        'fruits-01': {
          sharedGroups: ['core-mascots', 'missing-group'],
          manifest: { images: ['apple', 'banana'], audio: ['question1'], spritesheets: [] }
        },
        'legacy-extra-game': {
          manifest: { images: ['not-validated-in-this-slice'], audio: [], spritesheets: [] }
        }
      }
    });

    expect(validateActivityAssetPins(result, 'fruits-01')).toEqual({
      success: false,
      errors: [
        'games.fruits-01.sharedGroups.missing-group is not defined in sharedGroups',
        'games.fruits-01.manifest.images.banana is missing an image pin in pinnedAssets',
        'games.fruits-01.manifest.audio.question1 has a image pin, expected audio',
        'sharedGroups.core-mascots.images.guapen is missing an image pin in pinnedAssets'
      ]
    });
  });

  it('runs selected-game pin validation when validating an Activity-version assets.json file directly', () => {
    const fixtureRoot = join(tmpdir(), `activity-cli-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const activityRoot = join(fixtureRoot, 'activities/fruits-01');
    const versionRoot = join(activityRoot, 'versions/1');
    mkdirSync(versionRoot, { recursive: true });
    writeFileSync(join(activityRoot, 'activity.json'), JSON.stringify({
      activityId: 'fruits-01',
      version: 1,
      renderer: { id: 'multiple-choice', version: '^1.0.0' },
      gameId: 'fruits-01'
    }));
    writeFileSync(join(versionRoot, 'assets.json'), JSON.stringify({
      version: '2.0.0',
      baseUrl: 'assets',
      pinnedAssets: {},
      games: {
        'fruits-01': {
          manifest: { images: ['apple'], audio: [], spritesheets: [] }
        }
      }
    }));

    const result = spawnSync('npm run validate-config --silent -- ' + JSON.stringify(join(versionRoot, 'assets.json')), {
      cwd: join(repoRoot, 'packages/validation'),
      encoding: 'utf8',
      shell: true
    });

    const output = `${result.stdout}\n${result.stderr}`;
    expect(result.status).not.toBe(0);
    expect(output).toContain('games.fruits-01.manifest.images.apple is missing an image pin in pinnedAssets');
  });

  it('rejects asset registries without per-game manifests', () => {
    const result = activityAssetRegistrySchema.safeParse({
      version: '2.0.0',
      baseUrl: 'assets',
      pinnedAssets: {}
    });

    expect(result.success).toBe(false);
  });
});

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function imagePin(keyOrSha256: string, maybeSha256?: string) {
  const key = maybeSha256 ? keyOrSha256 : 'apple';
  const sha256 = maybeSha256 ?? keyOrSha256;
  return {
    type: 'image',
    assetId: `sha256-${sha256}`,
    sha256,
    path: `/assets/library/images/${key}.png`
  };
}

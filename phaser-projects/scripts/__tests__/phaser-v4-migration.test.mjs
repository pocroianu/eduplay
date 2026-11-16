import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const dependencyFiles = [
  'packages/game-core/package.json',
  'packages/phaser-ui/package.json',
  'tools/config-editor/package.json'
];

const sourceRoots = [
  'packages',
  'renderers'
];

const ignoredSegments = new Set(['node_modules', 'dist', 'coverage', '.vite']);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

const removedV3Apis = [
  /Phaser\.Geom\.Point\b/,
  /new\s+Phaser\.Display\.Masks\.BitmapMask\b/,
  /\.setTintFill\s*\(/,
  /\.tintFill\b/,
  /\.setPipeline\s*\(\s*['"]Light2D['"]\s*\)/,
  /\.preFX\b/,
  /\.postFX\b/,
  /Phaser\.Math\.PI2\b/,
  /Phaser\.Struct\.(Set|Map)\b/,
  /Phaser\.CANVAS\b/
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (ignoredSegments.has(entry)) continue;

    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      walk(path, files);
      continue;
    }

    const ext = path.slice(path.lastIndexOf('.'));
    if (sourceExtensions.has(ext)) {
      files.push(path);
    }
  }

  return files;
}

test('Phaser runtime packages target Phaser 4', () => {
  for (const file of dependencyFiles) {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, file), 'utf8'));
    const range = packageJson.dependencies?.phaser ?? packageJson.peerDependencies?.phaser;

    assert.match(range, /^(?:\^)?4\./, `${file} should target Phaser 4, got ${range}`);
  }
});

test('activity renderer source avoids removed Phaser 3 APIs', () => {
  const offenders = [];

  for (const root of sourceRoots) {
    for (const file of walk(join(repoRoot, root))) {
      const content = readFileSync(file, 'utf8');
      for (const pattern of removedV3Apis) {
        if (pattern.test(content)) {
          offenders.push(`${relative(repoRoot, file)} matches ${pattern}`);
        }
      }
    }
  }

  assert.deepEqual(offenders, []);
});

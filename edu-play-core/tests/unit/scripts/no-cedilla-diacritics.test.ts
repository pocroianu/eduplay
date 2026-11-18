import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// Romanian uses comma-below (ș ț), never the cedilla variants (U+015E/F, U+0162/3).
const CEDILLA = /[ŞşŢţ]/;
const ROOTS = ['src', 'public/locales'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.json', '.css', '.md']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(name))) out.push(full);
  }
  return out;
}

describe('Romanian diacritics', () => {
  it('uses comma-below s/t, never cedilla variants, in src and locales', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(path.resolve(process.cwd(), root))) {
        readFileSync(file, 'utf8')
          .split(/\r?\n/)
          .forEach((line, index) => {
            if (CEDILLA.test(line)) offenders.push(`${path.relative(process.cwd(), file)}:${index + 1}`);
          });
      }
    }
    expect(offenders).toEqual([]);
  });
});

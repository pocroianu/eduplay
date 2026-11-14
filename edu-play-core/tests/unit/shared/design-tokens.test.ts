import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const globalsCss = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

describe('global design tokens', () => {
  it('uses the Seesaw-inspired EduPlay token spine for standard surfaces', () => {
    expect(globalsCss).toContain('--color-primary:       #5F2FA8;');
    expect(globalsCss).toContain('--ep-purple-600: var(--color-primary);');
    expect(globalsCss).toContain('--color-success-journal: #2F7A2F;');
    expect(globalsCss).toContain('--font-body:    var(--font-lexend), "Lexend"');
  });

  it('keeps the primary spine purple instead of retired primary colors', () => {
    expect(globalsCss).toContain('--color-fun-green:       #2F7A2F;');
    expect(globalsCss).not.toContain('--color-primary:       #22C55E;');
    expect(globalsCss).not.toContain('--color-primary:       #0E7C8C;');
    expect(globalsCss).not.toContain('--ep-teal-600: var(--color-primary);');
    expect(globalsCss).not.toContain('--font-body:    var(--font-baloo)');
    expect(globalsCss).not.toContain('--font-baloo');
    expect(globalsCss).not.toContain('font-baloo');
  });
});

function collectProductionSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    const relativePath = relative(process.cwd(), fullPath).replaceAll('\\', '/');

    if (
      entry.isDirectory() &&
      entry.name !== 'seesaw-design-system' &&
      entry.name !== '__tests__'
    ) {
      return collectProductionSourceFiles(fullPath);
    }

    if (
      entry.isFile() &&
      /\.(tsx?|jsx?)$/.test(entry.name) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.spec.tsx')
    ) {
      return [relativePath];
    }

    return [];
  });
}

const PRODUCT_SOURCE_FILES = collectProductionSourceFiles(join(process.cwd(), 'src'));

describe('product design conformance', () => {
  it('does not use legacy Duo or chunky kid-mode styling in product UI', () => {
    const bannedPatterns = [
      'duo-card',
      'duo-ghost-border',
      'bg-duo-',
      'text-duo-',
      'border-duo-',
      'rounded-duo',
      'shadow-duo',
      'duo-panel',
      'duo-skeleton-shimmer',
      'duo-progress-indeterminate',
      'shadow-chunk',
      'border-2 border-ink',
      'border-2 border-outline',
      'border-2 border-primary',
      'font-black',
      'font-extrabold',
      'rounded-3xl',
      'backdrop-blur',
      'bg-gradient',
      "type: 'spring'",
      'type: "spring"',
      'springBouncy',
      'bounceIn',
      'shadow-2xl',
      'rounded-kid-card',
      'whileTap={{ scale',
      'animate={{ scale',
      'scale: [',
      '✨',
      '⭐',
    ];

    const offenders = PRODUCT_SOURCE_FILES.flatMap((relativePath) => {
      const source = readFileSync(join(process.cwd(), relativePath), 'utf8');

      return bannedPatterns
        .filter((pattern) => source.includes(pattern))
        .map((pattern) => `${relativePath}: ${pattern}`);
    });

    expect(offenders).toEqual([]);
  });

  it('does not keep legacy Duo or chunky compatibility utilities in globals', () => {
    const bannedGlobals = [
      '--shadow-chunk',
      '.duo-card',
      '.duo-ghost-border',
      '.duo-panel',
      '.duo-skeleton-shimmer',
      '.duo-progress-indeterminate',
      '@keyframes duo-',
      '.bg-gradient-primary',
    ];

    const offenders = bannedGlobals.filter((pattern) => globalsCss.includes(pattern));

    expect(offenders).toEqual([]);
  });
});

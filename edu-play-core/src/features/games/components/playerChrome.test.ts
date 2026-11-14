import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { expectMantineSkeletonLoading } from '@/test-utils/source-file-guards';

const FILES = [
  'src/app/play/[activityId]/error.tsx',
  'src/app/play/[activityId]/loading.tsx',
  'src/features/games/components/ActivityNavbar.tsx',
  'src/features/games/components/CategoryFilter.tsx',
  'src/features/games/components/CoachFAB.tsx',
  'src/features/games/components/ExitConfirmDialog.tsx',
  'src/features/games/components/GameCard.tsx',
  'src/features/games/components/GameEmbed.tsx',
  'src/features/games/components/GameLibraryHero.tsx',
  'src/features/games/components/LessonDrawer.tsx',
  'src/features/games/components/OfflineNotice.tsx',
  'src/features/games/components/PreGameCover.tsx',
  'src/features/games/components/ActionStrip.tsx',
  'src/features/games/components/CategoryBanner.tsx',
  'src/features/games/components/PromotionalCard.tsx',
  'src/shared/components/ui/kit/Card.tsx',
  'src/shared/components/ui/kit/StatCard.tsx',
] as const;

const BLACK_CHROME_PATTERN = /border-ink|ring-ink|shadow-chunk(?:-sm|-lg)?\b(?!-)|var\(--shadow-chunk(?:-sm|-lg)?\)|3px solid var\(--color-on-surface\)|0 [45]px 0 0 var\(--color-on-surface\)/;
const HARD_3D_OFFSET_SHADOW_PATTERN = /boxShadow:\s*['"`]0\s+\d+px\s+0\s+0/;
const DISALLOWED_TOUCH_SURFACE_PATTERN = /backdrop-blur|active:scale|whileTap=\{\{\s*scale/;
const REDUCED_MOTION_PRESS_FILES = [
  'src/features/games/components/ActionStrip.tsx',
  'src/features/games/components/GameLibraryHero.tsx',
] as const;

function findSourceLines(files: readonly string[], pattern: RegExp) {
  return files.flatMap((file) => {
    const content = readFileSync(join(process.cwd(), file), 'utf8');

    return content
      .split('\n')
      .map((line, index) => ({ file, line: index + 1, content: line.trim() }))
      .filter(({ content }) => pattern.test(content));
  });
}

describe('player chrome', () => {
  it('does not use black ink borders or black chunk shadows', () => {
    expect(findSourceLines(FILES, BLACK_CHROME_PATTERN)).toEqual([]);
  });

  it('uses soft token shadows instead of hard 3D offset shadows', () => {
    expect(findSourceLines(FILES, HARD_3D_OFFSET_SHADOW_PATTERN)).toEqual([]);
  });

  it('avoids scale and backdrop-blur interactions on play surfaces', () => {
    expect(findSourceLines(FILES, DISALLOWED_TOUCH_SURFACE_PATTERN)).toEqual([]);
  });

  it('uses Mantine skeletons instead of Tailwind pulse classes on play loading', () => {
    expectMantineSkeletonLoading('src/app/play/[activityId]/loading.tsx');
  });

  it('uses Mantine-backed buttons for game chrome action controls', () => {
    const controlFiles = [
      'src/features/games/components/ActionStrip.tsx',
      'src/features/games/components/CategoryBanner.tsx',
      'src/features/games/components/CoachFAB.tsx',
      'src/features/games/components/GameLibraryHero.tsx',
      'src/features/games/components/LessonDrawer.tsx',
      'src/features/games/components/PromotionalCard.tsx',
    ];

    expect(findSourceLines(controlFiles, /<button|motion\.button/)).toEqual([]);
    expect(findSourceLines(controlFiles, /GameChromeButton/).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps custom press translations reduced-motion aware', () => {
    for (const file of REDUCED_MOTION_PRESS_FILES) {
      const content = readFileSync(join(process.cwd(), file), 'utf8');

      expect(content).toContain('useReducedMotion');
    }
  });

  it('uses the shared Mantine-backed confirm dialog for the game exit prompt', () => {
    const content = readFileSync(
      join(process.cwd(), 'src/features/games/components/ExitConfirmDialog.tsx'),
      'utf8',
    );

    expect(content).toContain('ConfirmDialog');
    expect(content).not.toMatch(/AnimatePresence|motion\.div|window\.addEventListener\(["']keydown/);
  });
});

import { test } from '@playwright/test';
import { expectInitialActivityLoad } from '../../utils/initial-load';

test.describe('Memory Game — animals-memory-01 initial load', () => {
  test('loads the activity canvas, config, and initial runtime state', async ({ page }) => {
    await expectInitialActivityLoad(page, {
      templateId: 'memory-game',
      activityId: 'animals-memory-01',
      sceneKey: 'MemoryLevel',
      lang: 'ro',
      expectedStepCount: 6,
      expectedMaxScore: 60,
    });
  });
});

import { test } from '@playwright/test';
import { expectInitialActivityLoad } from '../../utils/initial-load';

test.describe('Categorize Game — animals-habitat-01 initial load', () => {
  test('loads the activity canvas, config, and initial runtime state', async ({ page }) => {
    await expectInitialActivityLoad(page, {
      templateId: 'categorize-game',
      activityId: 'animals-habitat-01',
      sceneKey: 'CategorizeLevel',
      lang: 'ro',
      expectedStepCount: 6,
      expectedMaxScore: 60,
    });
  });
});

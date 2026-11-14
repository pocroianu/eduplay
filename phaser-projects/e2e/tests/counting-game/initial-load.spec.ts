import { test } from '@playwright/test';
import { expectInitialActivityLoad } from '../../utils/initial-load';

test.describe('Counting Game — farm-count-01 initial load', () => {
  test('loads the activity canvas, config, and initial runtime state', async ({ page }) => {
    await expectInitialActivityLoad(page, {
      templateId: 'counting-game',
      activityId: 'farm-count-01',
      sceneKey: 'CountingLevel',
      lang: 'ro',
      expectedStepCount: 5,
      expectedMaxScore: 50,
    });
  });
});

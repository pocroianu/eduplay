import { test } from '@playwright/test';
import { expectInitialActivityLoad } from '../../utils/initial-load';

test.describe('Pattern Game — shapes-pattern-01 initial load', () => {
  test('loads the activity canvas, config, and initial runtime state', async ({ page }) => {
    await expectInitialActivityLoad(page, {
      templateId: 'pattern-game',
      activityId: 'shapes-pattern-01',
      sceneKey: 'PatternLevel',
      lang: 'ro',
      expectedStepCount: 5,
      expectedMaxScore: 50,
    });
  });
});

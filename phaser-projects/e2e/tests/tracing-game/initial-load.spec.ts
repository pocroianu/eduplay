import { test } from '@playwright/test';
import { expectInitialActivityLoad } from '../../utils/initial-load';

test.describe('Tracing Game — shapes-basic initial load', () => {
  test('loads the activity canvas, config, and initial runtime state', async ({ page }) => {
    await expectInitialActivityLoad(page, {
      templateId: 'tracing-game',
      activityId: 'shapes-basic',
      sceneKey: 'TracingLevel',
      lang: 'ro',
      expectedStepCount: 4,
      expectedMaxScore: 40,
    });
  });
});

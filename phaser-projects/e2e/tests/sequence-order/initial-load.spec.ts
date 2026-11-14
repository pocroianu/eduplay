import { test } from '@playwright/test';
import { expectInitialActivityLoad } from '../../utils/initial-load';

test.describe('Sequence Order — numbers-1-to-6 initial load', () => {
  test('loads the activity canvas, config, and initial runtime state', async ({ page }) => {
    await expectInitialActivityLoad(page, {
      templateId: 'sequence-order',
      activityId: 'numbers-1-to-6',
      sceneKey: 'SequenceLevel',
      lang: 'ro',
      expectedStepCount: 6,
      expectedMaxScore: 60,
    });
  });
});

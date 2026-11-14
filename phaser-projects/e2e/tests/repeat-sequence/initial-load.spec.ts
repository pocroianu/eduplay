import { test } from '@playwright/test';
import { expectInitialActivityLoad } from '../../utils/initial-load';

test.describe('Repeat Sequence — animals-sequence-01 initial load', () => {
  test('loads the activity canvas, config, and initial runtime state', async ({ page }) => {
    await expectInitialActivityLoad(page, {
      templateId: 'repeat-sequence',
      activityId: 'animals-sequence-01',
      sceneKey: 'SequenceLevel',
      lang: 'ro',
      expectedStepCount: 6,
      expectedMaxScore: 60,
    });
  });
});

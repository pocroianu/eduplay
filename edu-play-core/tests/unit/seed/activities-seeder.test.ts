import { describe, expect, it } from 'vitest';

import { toActivityRow } from '../../../scripts/seed/seeders/activities';
import type { SeedActivity } from '../../../scripts/seed/phaser-catalog';

function activity(overrides: Partial<SeedActivity> = {}): SeedActivity {
  return {
    id: 'activity-1',
    versionId: 'version-1',
    typeId: 'multiple-choice',
    rendererKey: 'activity-host',
    sourceActivityId: 'fruits-01',
    title: 'Fruit Quiz',
    description: 'Learn fruits',
    thumbnailUrl: null,
    category: 'vocabulary',
    difficulty: 'easy',
    targetAgeMin: 3,
    targetAgeMax: 8,
    estimatedDuration: 5,
    questionCount: 3,
    tags: ['seed:baseline'],
    subject: 'romanian',
    skills: ['vocabulary'],
    configData: { meta: { gameId: 'fruits-01' } },
    schemaVersion: 1,
    templateLabel: 'Multiple Choice',
    templateWorkspace: '@edu-play/game-core',
    configPath: '/activities/fruits-01/versions/1/config.json',
    ...overrides,
  };
}

describe('activity seed rows', () => {
  it('publishes Phaser baseline activities as public library activities', () => {
    expect(toActivityRow(activity())).toMatchObject({
      id: 'activity-1',
      template: 'multiple-choice',
      visibility_scope: 'public',
      created_by: null,
      is_published: true,
      status: 'published',
    });
  });
});

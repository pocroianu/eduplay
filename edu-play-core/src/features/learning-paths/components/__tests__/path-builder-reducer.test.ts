import { describe, expect, it } from 'vitest';
import { pathBuilderReducer } from '../path-builder-reducer';
import type { LearningPathStep } from '../../types';

function step(id: string, stepOrder: number): LearningPathStep {
  return {
    id,
    pathId: '22222222-2222-4222-8222-222222222222',
    stepOrder,
    kind: 'activity_template',
    targetActivityType: 'drawing-canvas',
    targetActivityConfig: {},
    title: `Pas ${stepOrder + 1}`,
    description: null,
    createdAt: '2026-05-01T00:00:00Z',
  };
}

describe('pathBuilderReducer', () => {
  it('moves a dragged step and rewrites contiguous display order', () => {
    const state = {
      steps: [step('a', 0), step('b', 1), step('c', 2)],
    };

    const next = pathBuilderReducer(state, {
      type: 'moveStep',
      activeId: 'c',
      overId: 'a',
    });

    expect(next.steps.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(next.steps.map((item) => item.stepOrder)).toEqual([0, 1, 2]);
  });

  it('does not change state when the drag target is missing', () => {
    const state = {
      steps: [step('a', 0), step('b', 1)],
    };

    expect(
      pathBuilderReducer(state, {
        type: 'moveStep',
        activeId: 'a',
        overId: 'missing',
      }),
    ).toBe(state);
  });
});

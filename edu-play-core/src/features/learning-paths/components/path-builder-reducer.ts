import type { LearningPathStep } from '../types';

export interface PathBuilderState {
  steps: LearningPathStep[];
}

export type PathBuilderAction = {
  type: 'moveStep';
  activeId: string;
  overId: string | null;
};

function rewriteStepOrders(steps: LearningPathStep[]): LearningPathStep[] {
  return steps.map((step, index) => ({ ...step, stepOrder: index }));
}

export function pathBuilderReducer(
  state: PathBuilderState,
  action: PathBuilderAction,
): PathBuilderState {
  if (action.type !== 'moveStep' || !action.overId) return state;

  const from = state.steps.findIndex((step) => step.id === action.activeId);
  const to = state.steps.findIndex((step) => step.id === action.overId);
  if (from === -1 || to === -1 || from === to) return state;

  const nextSteps = [...state.steps];
  const [moved] = nextSteps.splice(from, 1);
  if (!moved) return state;
  nextSteps.splice(to, 0, moved);

  return { steps: rewriteStepOrders(nextSteps) };
}

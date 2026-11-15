import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PathBuilder } from './PathBuilder';
import { addStep, reorderSteps } from '../actions';
import type { LearningPath, LearningPathStep } from '../types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../actions', () => ({
  addStep: vi.fn(),
  publishPath: vi.fn(),
  reorderSteps: vi.fn(),
}));

const reorderStepsMock = vi.mocked(reorderSteps);
const addStepMock = vi.mocked(addStep);

function path(): LearningPath {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Parcurs de test',
    description: null,
    ageMin: null,
    ageMax: null,
    status: 'draft',
    ownerKind: 'teacher',
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
  };
}

function step(id: string, stepOrder: number): LearningPathStep {
  return {
    id,
    pathId: '11111111-1111-4111-8111-111111111111',
    stepOrder,
    kind: 'activity_template',
    targetActivityType: 'drawing-canvas',
    targetActivityConfig: {},
    title: `Pas ${stepOrder + 1}`,
    description: null,
    createdAt: '2026-05-01T00:00:00Z',
  };
}

describe('PathBuilder', () => {
  beforeEach(() => {
    addStepMock.mockReset();
    addStepMock.mockResolvedValue({
      success: true,
      data: { step: step('step-new', 0) },
    });
    reorderStepsMock.mockReset();
    reorderStepsMock.mockResolvedValue({
      success: true,
      data: { orderedStepIds: ['step-b', 'step-a'] },
    });
  });

  it('persists reordered step ids after a successful drag', async () => {
    render(
      <MantineProvider>
        <PathBuilder
          path={path()}
          initialSteps={[step('step-a', 0), step('step-b', 1)]}
          activityTypes={[]}
          classes={[]}
          students={[]}
          assignments={[]}
        />
      </MantineProvider>,
    );

    const [firstStep, secondStep] = screen.getAllByTestId('learning-path-step');
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'step-b'),
      effectAllowed: '',
    };

    fireEvent.dragStart(secondStep, { dataTransfer });
    fireEvent.dragOver(firstStep, { dataTransfer });
    fireEvent.drop(firstStep, { dataTransfer });

    await waitFor(() => {
      expect(reorderStepsMock).toHaveBeenCalledWith({
        pathId: '11111111-1111-4111-8111-111111111111',
        orderedStepIds: ['step-b', 'step-a'],
      });
    });
  });

  it('adds a step from the Mantine activity picker', async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
        <PathBuilder
          path={path()}
          initialSteps={[]}
          activityTypes={[
            {
              typeId: 'drawing-canvas',
              displayName: 'Desen liber',
              category: 'Creativitate',
            },
          ]}
          classes={[]}
          students={[]}
          assignments={[]}
        />
      </MantineProvider>,
    );

    await user.click(screen.getByRole('button', { name: /alegere/i }));
    await user.click(
      await screen.findByRole('option', { name: /desen liber/i, hidden: true }),
    );
    await user.type(screen.getByTestId('learning-path-step-title'), 'Primul pas');
    await user.click(screen.getByTestId('learning-path-add-step'));

    await waitFor(() => expect(addStepMock).toHaveBeenCalledTimes(1));
    expect(addStepMock).toHaveBeenCalledWith({
      pathId: '11111111-1111-4111-8111-111111111111',
      kind: 'activity_template',
      title: 'Primul pas',
      description: null,
      targetActivityType: 'drawing-canvas',
      targetActivityConfig: {},
    });
  });
});

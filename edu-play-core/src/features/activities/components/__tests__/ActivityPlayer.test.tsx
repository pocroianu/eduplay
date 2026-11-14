import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { z } from 'zod';
import { ActivityPlayer } from '../ActivityPlayer';
import {
  __resetActivityTypeRegistryForTests,
  registerActivityType,
} from '../../registry';
import type { ActivityInstance, ActivityTypeDefinition } from '../../types';

const INSTANCE: ActivityInstance = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  typeId: 'gated-test',
  config: { promptText: 'Desenează ceva frumos' },
  assignedTo: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
  classId: '6ba7b811-9dad-41d1-80b4-00c04fd430c8',
  sourceLearningPathStepId: null,
  resultSummary: null,
  createdBy: '6ba7b812-9dad-41d1-80b4-00c04fd430c8',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
};

function registerGatedType(
  override: Partial<
    ActivityTypeDefinition<{ promptText: string }, { url: string }>
  > = {},
) {
  const def: ActivityTypeDefinition<{ promptText: string }, { url: string }> = {
    typeId: 'gated-test',
    displayName: 'Test Gated Activity',
    icon: 'Palette',
    configSchema: z.object({ promptText: z.string() }),
    RendererComponent: ({ config }) => (
      <div data-testid="renderer">renderer:{config.promptText}</div>
    ),
    resultCollector: async (result) => ({
      studentId: INSTANCE.assignedTo,
      classId: INSTANCE.classId,
      artifactType: 'drawing',
      storagePath: result.url,
    }),
    ...override,
  };
  registerActivityType(def);
}

describe('<ActivityPlayer /> gate', () => {
  beforeEach(() => {
    __resetActivityTypeRegistryForTests();
  });

  it('mounts the renderer when gateResult is allowed', () => {
    registerGatedType();

    render(
      <ActivityPlayer
        instance={INSTANCE}
        gateResult={{ allowed: true }}
      />,
    );

    expect(screen.getByTestId('renderer')).toBeInTheDocument();
    expect(screen.queryByText(/permisiune/i)).not.toBeInTheDocument();
  });

  it('mounts the renderer when no gateResult is provided (gate-less type)', () => {
    registerGatedType();

    render(<ActivityPlayer instance={INSTANCE} />);

    expect(screen.getByTestId('renderer')).toBeInTheDocument();
  });

  it('renders the consent_required empty state and hides the renderer', () => {
    registerGatedType();

    render(
      <ActivityPlayer
        instance={INSTANCE}
        gateResult={{ allowed: false, reason: 'consent_required' }}
      />,
    );

    expect(screen.queryByTestId('renderer')).not.toBeInTheDocument();
    expect(screen.getByText(/permisiune/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /înapoi la tabloul de bord/i }),
    ).toBeInTheDocument();
  });

  it('renders the grade_locked empty state with kid-mode CTA', () => {
    registerGatedType();

    render(
      <ActivityPlayer
        instance={INSTANCE}
        gateResult={{ allowed: false, reason: 'grade_locked' }}
      />,
    );

    expect(screen.queryByTestId('renderer')).not.toBeInTheDocument();
    expect(screen.getByText(/clasa ta/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /înapoi la tabloul de bord/i }),
    ).toBeInTheDocument();
  });

  it('renders the class_disabled empty state', () => {
    registerGatedType();

    render(
      <ActivityPlayer
        instance={INSTANCE}
        gateResult={{ allowed: false, reason: 'class_disabled' }}
      />,
    );

    expect(screen.queryByTestId('renderer')).not.toBeInTheDocument();
    expect(screen.getByText(/închisă acum/i)).toBeInTheDocument();
  });

  it('resolves messageKey as a body override key when present, keeping reason-based title', () => {
    registerGatedType();

    render(
      <ActivityPlayer
        instance={INSTANCE}
        gateResult={{
          allowed: false,
          reason: 'consent_required',
          messageKey: 'player.gate.consent.audioRecordingBody',
        }}
      />,
    );

    expect(screen.getByText(/avem nevoie de permisiune/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /vocea ta e specială — avem nevoie de acordul cuiva mare/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/roagă pe cineva mare să dea acordul/i),
    ).not.toBeInTheDocument();
  });

  it('disables submit/save toolbar actions when the gate denies', () => {
    registerGatedType();

    render(
      <ActivityPlayer
        instance={INSTANCE}
        gateResult={{ allowed: false, reason: 'consent_required' }}
      />,
    );

    const submit = screen.getByRole('button', { name: /trimite/i });
    expect(submit).toBeDisabled();
    const save = screen.getByRole('button', { name: /salvează/i });
    expect(save).toBeDisabled();
  });
});

import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  __resetActivityTypeRegistryForTests,
  getActivityType,
  listActivityTypes,
  registerActivityType,
} from '../registry';
import type {
  ActivityTypeDefinition,
  GateResult,
  StudentActivityContext,
} from '../../types';

const fakeRendererFactory = () => () => null;

function makeFakeType(
  typeId = 'fake-drawing',
): ActivityTypeDefinition<{ promptText: string }, { url: string }> {
  return {
    typeId,
    displayName: 'Fake Drawing',
    icon: 'Palette',
    configSchema: z.object({ promptText: z.string() }),
    RendererComponent: fakeRendererFactory(),
    resultCollector: async (result) => ({
      studentId: '00000000-0000-0000-0000-000000000001',
      classId: null,
      artifactType: 'drawing',
      storagePath: result.url,
    }),
  };
}

describe('activity-type registry', () => {
  beforeEach(() => {
    __resetActivityTypeRegistryForTests();
  });

  it('registers a definition and looks it up by typeId', () => {
    const def = makeFakeType();
    registerActivityType(def);
    expect(getActivityType('fake-drawing')).toBe(def);
  });

  it('returns undefined for unknown typeIds', () => {
    expect(getActivityType('unknown')).toBeUndefined();
  });

  it('rejects empty typeId', () => {
    const def = { ...makeFakeType(), typeId: '' };
    expect(() =>
      registerActivityType(
        def as unknown as ActivityTypeDefinition<unknown, unknown>,
      ),
    ).toThrow(/typeId/);
  });

  it('rejects duplicate typeId registrations with different definitions', () => {
    registerActivityType(makeFakeType());
    expect(() => registerActivityType(makeFakeType())).toThrow(/duplicate/);
  });

  it('treats re-registering the same definition as a no-op (HMR safety)', () => {
    const def = makeFakeType();
    registerActivityType(def);
    expect(() => registerActivityType(def)).not.toThrow();
    expect(listActivityTypes()).toHaveLength(1);
  });

  it('listActivityTypes returns every registered definition', () => {
    registerActivityType(makeFakeType('a'));
    registerActivityType(makeFakeType('b'));
    const ids = listActivityTypes().map((d) => d.typeId).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('preserves an optional gate hook through register/lookup', async () => {
    const gate = async (ctx: StudentActivityContext): Promise<GateResult> => {
      return ctx.studentId === 'consenting'
        ? { allowed: true }
        : { allowed: false, reason: 'consent_required' };
    };

    const def: ActivityTypeDefinition<{ promptText: string }, { url: string }> =
      {
        ...makeFakeType('with-gate'),
        gate,
      };

    registerActivityType(def);
    const looked = getActivityType('with-gate');
    expect(looked?.gate).toBe(gate);

    const allowed = await looked?.gate?.({
      studentId: 'consenting',
      classId: null,
      supabase: {} as StudentActivityContext['supabase'],
      instance: {
        id: 'i',
        typeId: 'with-gate',
        config: {},
        assignedTo: 'consenting',
        classId: null,
        sourceLearningPathStepId: null,
        resultSummary: null,
        createdBy: 't',
        createdAt: 'now',
        updatedAt: 'now',
      },
    });
    expect(allowed).toEqual({ allowed: true });

    const denied = await looked?.gate?.({
      studentId: 'no-consent',
      classId: null,
      supabase: {} as StudentActivityContext['supabase'],
      instance: {
        id: 'i',
        typeId: 'with-gate',
        config: {},
        assignedTo: 'no-consent',
        classId: null,
        sourceLearningPathStepId: null,
        resultSummary: null,
        createdBy: 't',
        createdAt: 'now',
        updatedAt: 'now',
      },
    });
    expect(denied).toEqual({
      allowed: false,
      reason: 'consent_required',
    });
  });
});

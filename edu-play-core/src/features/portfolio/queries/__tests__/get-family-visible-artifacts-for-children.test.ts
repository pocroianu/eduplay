import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFamilyVisibleArtifactsForChildren } from '../get-family-visible-artifacts-for-children';
import { fakeClient, makeArtifactRow } from './fake-supabase';

const STUDENT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ART_A_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ART_B_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLASS_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const validArtifactRow = (overrides: Record<string, unknown> = {}) =>
  makeArtifactRow({
    id: ART_A_ID,
    student_id: STUDENT_A,
    class_id: CLASS_ID,
    visibility: 'family_visible',
    reviewed_at: '2026-05-01T10:00:00.000Z',
    ...overrides,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getFamilyVisibleArtifactsForChildren', () => {
  it('returns an empty array without hitting Supabase when studentIds is empty', async () => {
    const { client, from } = fakeClient({ perTable: {} });

    const out = await getFamilyVisibleArtifactsForChildren(client, []);

    expect(out).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('issues a single .in() call against child_artifacts (no per-student loop)', async () => {
    const rowA = validArtifactRow({
      id: ART_A_ID,
      student_id: STUDENT_A,
      reviewed_at: '2026-05-01T10:00:00.000Z',
    });
    const rowB = validArtifactRow({
      id: ART_B_ID,
      student_id: STUDENT_B,
      reviewed_at: '2026-05-01T11:00:00.000Z',
    });
    const { client, fromCalls, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [rowB, rowA], error: null }] },
    });

    const out = await getFamilyVisibleArtifactsForChildren(client, [
      STUDENT_A,
      STUDENT_B,
    ]);

    expect(fromCalls).toEqual(['child_artifacts']);
    // Returned in the order Supabase ordered them — preserved by the helper.
    expect(out.map((a) => a.id)).toEqual([ART_B_ID, ART_A_ID]);
    // Snake-cased DB columns are camelCased before being returned.
    expect(out[0]).toMatchObject({
      studentId: STUDENT_B,
      classId: CLASS_ID,
      visibility: 'family_visible',
      reviewedAt: '2026-05-01T11:00:00.000Z',
    });

    const ins = trace.calls.filter((c) => c.fn === 'in');
    expect(ins).toEqual([
      { fn: 'in', args: ['student_id', [STUDENT_A, STUDENT_B]] },
    ]);
    const eqs = trace.calls.filter((c) => c.fn === 'eq');
    expect(eqs).toEqual([
      { fn: 'eq', args: ['visibility', 'family_visible'] },
    ]);
  });

  it('orders by reviewed_at desc with id as the tie-break (matches singular helper)', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getFamilyVisibleArtifactsForChildren(client, [STUDENT_A]);

    const orders = trace.calls.filter((c) => c.fn === 'order');
    expect(orders).toEqual([
      {
        fn: 'order',
        args: ['reviewed_at', { ascending: false, nullsFirst: false }],
      },
      { fn: 'order', args: ['id', { ascending: false }] },
    ]);
  });

  it('applies a strict .lt() filter for the lt-ts cursor mode', async () => {
    const cursor = '2026-04-29T08:00:00.000Z';
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getFamilyVisibleArtifactsForChildren(client, [STUDENT_A], {
      cursor: { mode: 'lt-ts', ts: cursor },
    });

    expect(trace.calls.filter((c) => c.fn === 'lt')).toEqual([
      { fn: 'lt', args: ['reviewed_at', cursor] },
    ]);
    expect(trace.calls.filter((c) => c.fn === 'lte')).toEqual([]);
    expect(trace.calls.filter((c) => c.fn === 'or')).toEqual([]);
  });

  it('applies .lte() for the le-ts cursor mode (anchor lives on milestone side)', async () => {
    const cursor = '2026-04-29T08:00:00.000Z';
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getFamilyVisibleArtifactsForChildren(client, [STUDENT_A], {
      cursor: { mode: 'le-ts', ts: cursor },
    });

    expect(trace.calls.filter((c) => c.fn === 'lte')).toEqual([
      { fn: 'lte', args: ['reviewed_at', cursor] },
    ]);
    expect(trace.calls.filter((c) => c.fn === 'lt')).toEqual([]);
    expect(trace.calls.filter((c) => c.fn === 'or')).toEqual([]);
  });

  it('applies a tuple .or() filter for the lt-or-id-at-ts cursor mode', async () => {
    const ts = '2026-04-29T08:00:00.000Z';
    const idAtTs = ART_A_ID;
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getFamilyVisibleArtifactsForChildren(client, [STUDENT_A], {
      cursor: { mode: 'lt-or-id-at-ts', ts, idAtTs },
    });

    expect(trace.calls.filter((c) => c.fn === 'or')).toEqual([
      {
        fn: 'or',
        args: [
          `reviewed_at.lt.${ts},and(reviewed_at.eq.${ts},id.lt.${idAtTs})`,
        ],
      },
    ]);
    expect(trace.calls.filter((c) => c.fn === 'lt')).toEqual([]);
    expect(trace.calls.filter((c) => c.fn === 'lte')).toEqual([]);
  });

  it('throws when the underlying query errors', async () => {
    const { client } = fakeClient({
      perTable: {
        child_artifacts: [{ data: null, error: { message: 'rls denied' } }],
      },
    });

    await expect(
      getFamilyVisibleArtifactsForChildren(client, [STUDENT_A]),
    ).rejects.toThrow(/rls denied/);
  });

  it('throws ApiError on row schema drift (parseRows boundary)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Missing required fields — simulates a column drop / drift.
    const malformed = { id: ART_A_ID, student_id: STUDENT_A };
    const { client } = fakeClient({
      perTable: { child_artifacts: [{ data: [malformed], error: null }] },
    });

    await expect(
      getFamilyVisibleArtifactsForChildren(client, [STUDENT_A]),
    ).rejects.toThrow(/Database row failed validation/);
  });
});

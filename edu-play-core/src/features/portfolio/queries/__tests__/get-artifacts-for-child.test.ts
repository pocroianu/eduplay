import { describe, expect, it } from 'vitest';
import { getArtifactsForChild } from '../get-artifacts-for-child';
import { fakeClient, makeArtifactRow } from './fake-supabase';

const STUDENT_ID = '22222222-2222-2222-2222-222222222222';

describe('getArtifactsForChild', () => {
  it('parent role: filters to family_visible only and excludes archived', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getArtifactsForChild(client, { childId: STUDENT_ID, role: 'parent' });

    const eqs = trace.calls.filter((c) => c.fn === 'eq');
    expect(eqs).toEqual(
      expect.arrayContaining([
        { fn: 'eq', args: ['student_id', STUDENT_ID] },
        { fn: 'eq', args: ['visibility', 'family_visible'] },
      ]),
    );
    // The visibility eq filter already excludes archived rows; no `not(...)`
    // call is needed.
    const nots = trace.calls.filter((c) => c.fn === 'not');
    expect(nots).toEqual([]);
  });

  it('teacher role: scopes to student and excludes archived by default', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getArtifactsForChild(client, {
      childId: STUDENT_ID,
      role: 'teacher',
    });

    const eqs = trace.calls.filter((c) => c.fn === 'eq');
    expect(eqs).toEqual(
      expect.arrayContaining([{ fn: 'eq', args: ['student_id', STUDENT_ID] }]),
    );
    // No visibility eq lock for teachers — they see drafts + family-visible
    // (RLS scopes the row set to their classes).
    expect(
      eqs.some(
        (c) =>
          Array.isArray(c.args) &&
          c.args[0] === 'visibility' &&
          c.args[1] === 'family_visible',
      ),
    ).toBe(false);

    const nots = trace.calls.filter((c) => c.fn === 'not');
    expect(nots).toEqual([
      { fn: 'not', args: ['visibility', 'eq', 'archived'] },
    ]);
  });

  it('teacher role: includes archived when includeArchived=true', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getArtifactsForChild(client, {
      childId: STUDENT_ID,
      role: 'teacher',
      includeArchived: true,
    });

    const nots = trace.calls.filter((c) => c.fn === 'not');
    expect(nots).toEqual([]);
  });

  it('admin role: returns every visibility (no visibility filter)', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getArtifactsForChild(client, { childId: STUDENT_ID, role: 'admin' });

    const eqs = trace.calls.filter((c) => c.fn === 'eq');
    // Only student_id eq is applied.
    expect(eqs).toEqual([{ fn: 'eq', args: ['student_id', STUDENT_ID] }]);
    const nots = trace.calls.filter((c) => c.fn === 'not');
    expect(nots).toEqual([]);
  });

  it('orders by created_at desc with id as a stable tie-break', async () => {
    const { client, trace } = fakeClient({
      perTable: { child_artifacts: [{ data: [], error: null }] },
    });

    await getArtifactsForChild(client, { childId: STUDENT_ID, role: 'parent' });

    const orders = trace.calls.filter((c) => c.fn === 'order');
    expect(orders).toEqual([
      { fn: 'order', args: ['created_at', { ascending: false }] },
      { fn: 'order', args: ['id', { ascending: false }] },
    ]);
  });

  it('parses rows through artifactRowSchema and returns camelCased Artifact', async () => {
    // Use v4-compliant UUIDs since artifactRowSchema's `.uuid()` validator
    // rejects the shared fixture's repeating-digit pattern (nil-style ids).
    const row = makeArtifactRow({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      student_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      class_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      visibility: 'family_visible',
      title: 'Pictura',
    });
    const { client } = fakeClient({
      perTable: { child_artifacts: [{ data: [row], error: null }] },
    });

    const out = await getArtifactsForChild(client, {
      childId: STUDENT_ID,
      role: 'parent',
    });

    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(
      expect.objectContaining({
        id: row.id,
        studentId: row.student_id,
        classId: row.class_id,
        title: 'Pictura',
        artifactType: row.artifact_type,
        visibility: 'family_visible',
        storagePath: row.storage_path,
      }),
    );
  });

  it('throws when the underlying query errors', async () => {
    const { client } = fakeClient({
      perTable: {
        child_artifacts: [{ data: null, error: { message: 'rls denied' } }],
      },
    });

    await expect(
      getArtifactsForChild(client, { childId: STUDENT_ID, role: 'parent' }),
    ).rejects.toThrow(/rls denied/);
  });

  it('rejects unknown roles before issuing a query', async () => {
    const { client, fromCalls } = fakeClient({
      perTable: { child_artifacts: [] },
    });

    await expect(
      getArtifactsForChild(client, {
        childId: STUDENT_ID,
        // @ts-expect-error — intentionally invalid role for runtime guard
        role: 'student',
      }),
    ).rejects.toThrow(/role/i);
    expect(fromCalls).toHaveLength(0);
  });
});

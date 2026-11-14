import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildArtifactPublishedMessage,
  notifyArtifactPublished,
} from '../notify-artifact-published';

interface RpcCapture {
  fn?: string;
  args?: Record<string, unknown>;
}

function fakeSupabase({
  studentRow,
  studentError,
  rpcError,
}: {
  studentRow?: { username: string | null } | null;
  studentError?: { message: string } | null;
  rpcError?: { message: string } | null;
} = {}) {
  const capture: RpcCapture = {};
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() =>
    Promise.resolve({ data: studentRow ?? null, error: studentError ?? null }),
  );

  return {
    capture,
    client: {
      from: vi.fn(() => builder),
      rpc: vi.fn((fn: string, args: Record<string, unknown>) => {
        capture.fn = fn;
        capture.args = args;
        return Promise.resolve({ error: rpcError ?? null });
      }),
    } as unknown as Parameters<typeof notifyArtifactPublished>[0]['supabase'],
  };
}

describe('buildArtifactPublishedMessage', () => {
  it('uses child name and artifact title when present', () => {
    const message = buildArtifactPublishedMessage('Maria', 'Steaua mea');
    expect(message).toBe('Vulpița a publicat „Steaua mea” pentru Maria.');
  });

  it('falls back to a generic phrase when artifact has no title', () => {
    const message = buildArtifactPublishedMessage('Maria', null);
    expect(message).toBe('Vulpița a publicat o lucrare nouă pentru Maria.');
  });

  it('uses a polite fallback when child name is missing', () => {
    const message = buildArtifactPublishedMessage(null, 'Steaua mea');
    expect(message).toBe('Vulpița a publicat „Steaua mea” pentru copilul tău.');
  });
});

describe('notifyArtifactPublished', () => {
  const ARTIFACT = {
    id: '11111111-1111-4111-8111-111111111111',
    student_id: '22222222-2222-4222-8222-222222222222',
    title: 'Casa mea',
    artifact_type: 'drawing' as const,
  };

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('calls notify_linked_parents with composed copy and metadata', async () => {
    const { client, capture } = fakeSupabase({
      studentRow: { username: 'Maria' },
    });

    await notifyArtifactPublished({ supabase: client, artifact: ARTIFACT });

    expect(capture.fn).toBe('notify_linked_parents');
    expect(capture.args).toEqual({
      p_student_id: ARTIFACT.student_id,
      p_type: 'artifact_published',
      p_title: 'Lucrare nouă publicată',
      p_message: 'Vulpița a publicat „Casa mea” pentru Maria.',
      p_data: {
        artifact_id: ARTIFACT.id,
        artifact_type: 'drawing',
      },
    });
  });

  it('still dispatches with a fallback name when student lookup fails', async () => {
    const { client, capture } = fakeSupabase({
      studentRow: null,
      studentError: { message: 'rls' },
    });

    await notifyArtifactPublished({ supabase: client, artifact: ARTIFACT });

    expect(capture.args?.p_message).toBe(
      'Vulpița a publicat „Casa mea” pentru copilul tău.',
    );
  });

  it('does not throw when notify_linked_parents itself errors', async () => {
    const { client } = fakeSupabase({
      studentRow: { username: 'Maria' },
      rpcError: { message: 'boom' },
    });

    await expect(
      notifyArtifactPublished({ supabase: client, artifact: ARTIFACT }),
    ).resolves.toBeUndefined();
  });

  it('does not bubble out when supabase.rpc itself rejects', async () => {
    // Transient transport / service errors can reject the promise outright,
    // not just populate `error`. Without a try/catch this would mark the
    // publish as failed even though the row UPDATE already landed, and a
    // teacher retry would slip past the dedup gate.
    const studentBuilder: Record<string, unknown> = {};
    studentBuilder.select = vi.fn(() => studentBuilder);
    studentBuilder.eq = vi.fn(() => studentBuilder);
    studentBuilder.maybeSingle = vi.fn(() =>
      Promise.resolve({ data: { username: 'Maria' }, error: null }),
    );
    const client = {
      from: vi.fn(() => studentBuilder),
      rpc: vi.fn(() => Promise.reject(new Error('transport error'))),
    } as unknown as Parameters<typeof notifyArtifactPublished>[0]['supabase'];

    await expect(
      notifyArtifactPublished({ supabase: client, artifact: ARTIFACT }),
    ).resolves.toBeUndefined();
  });
});

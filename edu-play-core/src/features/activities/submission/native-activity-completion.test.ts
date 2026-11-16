import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';
import { completeNativeActivity } from './native-activity-completion';

vi.mock('@/features/portfolio/server', () => ({
  decodeArtifactPayload: () => ({
    bytes: new Uint8Array([1]),
    contentType: 'image/png',
    extension: 'png',
    artifactType: 'drawing',
  }),
}));
const student = 'c1000000-0000-4000-8000-000000000003';
const instanceId = 'd1000000-0000-4000-8000-000000000001';
const submissionId = 'd2000000-0000-4000-8000-000000000001';
const input = {
  kind: 'drawing' as const,
  instanceId,
  submissionId,
  payload: { dataUrl: 'data:image/png;base64,aGVsbG8=' },
};

function environment(
  options: {
    foreign?: boolean;
    progressFails?: boolean;
    lostCommit?: boolean;
    rejectedCommit?: boolean;
    readFails?: boolean;
  } = {},
) {
  let receipt: {
    id: string;
    artifact_id: string;
    native_activity_submission_targets: Array<{ settled: boolean }>;
  } | null = null;
  let path = '';
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  function from(table: string) {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => {
        if (table === 'activity_instances')
          return {
            data: options.foreign ? null : { id: instanceId },
            error: null,
          };
        if (table === 'students')
          return { data: { consents: { audio_recording: true } }, error: null };
        if (table === 'native_activity_submissions')
          return {
            data: receipt,
            error: options.readFails ? { message: 'offline' } : null,
          };
        return { data: { storage_path: path }, error: null };
      },
    };
    return builder;
  }
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'accept_native_activity_submission') {
      if (options.rejectedCommit)
        return { data: null, error: { message: 'offline' } };
      path = String(args.p_storage_path);
      receipt = {
        id: submissionId,
        artifact_id: 'artifact-1',
        native_activity_submission_targets: [{ settled: false }],
      };
      if (options.lostCommit) throw new Error('lost response after commit');
      return { data: receipt, error: null };
    }
    if (options.progressFails) throw new Error('progress offline');
    if (receipt) receipt.native_activity_submission_targets[0].settled = true;
    return { error: null };
  });
  const client = {
    from,
    rpc,
    storage: { from: () => ({ upload, remove }) },
  } as unknown as SupabaseClient<Database>;
  return { client, upload, remove, rpc };
}

describe('native Activity completion interface', () => {
  it('allows rejected media to be edited without locking an uncertain attempt', async () => {
    const e = environment();
    expect(
      await completeNativeActivity(e.client, () => e.client, student, {
        ...input,
        payload: { dataUrl: 'invalid' },
      }),
    ).toMatchObject({ success: false, canEdit: true });
    expect(e.upload).not.toHaveBeenCalled();
  });
  it('reuses the committed artifact on retry without another upload', async () => {
    const e = environment();
    const first = await completeNativeActivity(
      e.client,
      () => e.client,
      student,
      input,
    );
    const retry = await completeNativeActivity(
      e.client,
      () => e.client,
      student,
      input,
    );
    expect(first).toMatchObject({
      success: true,
      data: { artifactId: 'artifact-1', progressionPending: false },
    });
    expect(retry).toEqual(first);
    expect(e.upload).toHaveBeenCalledTimes(1);
  });
  it('keeps saved work successful when advancement fails', async () => {
    const e = environment({ progressFails: true });
    expect(
      await completeNativeActivity(e.client, () => e.client, student, input),
    ).toMatchObject({
      success: true,
      data: { artifactId: 'artifact-1', progressionPending: true },
    });
  });
  it('reconciles a lost commit response without deleting saved media', async () => {
    const e = environment({ lostCommit: true });
    expect(
      await completeNativeActivity(e.client, () => e.client, student, input),
    ).toMatchObject({ success: true });
    expect(e.remove).not.toHaveBeenCalled();
  });
  it('never deletes uploaded media when commit remains uncertain', async () => {
    const e = environment({ rejectedCommit: true });
    expect(
      await completeNativeActivity(e.client, () => e.client, student, input),
    ).toMatchObject({ success: false });
    expect(e.remove).not.toHaveBeenCalled();
  });
  it('checks instance ownership before upload or privileged work', async () => {
    const e = environment({ foreign: true });
    expect(
      await completeNativeActivity(e.client, () => e.client, student, input),
    ).toMatchObject({ success: false });
    expect(e.upload).not.toHaveBeenCalled();
    expect(e.rpc).not.toHaveBeenCalled();
  });
  it('does not upload when receipt recovery is unavailable', async () => {
    const e = environment({ readFails: true });
    await expect(
      completeNativeActivity(e.client, () => e.client, student, input),
    ).rejects.toThrow('Unable to read');
    expect(e.upload).not.toHaveBeenCalled();
  });
});

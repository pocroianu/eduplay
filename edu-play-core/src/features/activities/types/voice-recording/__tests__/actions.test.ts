import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
  recordChildArtifact: vi.fn(),
  advanceActivityCompletionProgress: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
  createAdminClient: mocks.createAdminClient,
}));

vi.mock('@/features/portfolio/server', () => ({
  recordChildArtifact: mocks.recordChildArtifact,
}));

vi.mock('@/features/learning-paths/server', () => ({
  advanceActivityCompletionProgress: mocks.advanceActivityCompletionProgress,
}));

import { submitVoiceRecordingArtifact } from '../actions';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const INSTANCE_ID = '550e8400-e29b-41d4-a716-446655440000';
const AUDIO_BYTES = new Uint8Array([1, 2, 3]);

beforeEach(() => {
  mocks.createClient.mockReset();
  mocks.createAdminClient.mockReset();
  mocks.recordChildArtifact.mockReset();
  mocks.recordChildArtifact.mockResolvedValue({
    success: true,
    data: { artifactId: '99999999-9999-4999-8999-999999999999' },
  });
  mocks.advanceActivityCompletionProgress.mockReset();
  mocks.advanceActivityCompletionProgress.mockResolvedValue(undefined);
});

describe('submitVoiceRecordingArtifact', () => {
  it('rejects an activity instance that is not assigned to the current student', async () => {
    const { client } = makeSupabaseClient({ instance: null });
    mocks.createClient.mockResolvedValue(client);

    const result = await submitVoiceRecordingArtifact({
      instanceId: INSTANCE_ID,
      blob: AUDIO_BYTES,
      mime: 'audio/webm',
      durationMs: 1200,
    });

    expect(result.success).toBe(false);
    expect(mocks.recordChildArtifact).not.toHaveBeenCalled();
  });

  it('records the audio artifact and marks the voice instance completed', async () => {
    const { client, adminClient, from, eq, userUpdate, adminUpdate } = makeSupabaseClient({
      instance: {
        id: INSTANCE_ID,
        type_id: 'voice-recording',
        assigned_to: STUDENT_ID,
      },
    });
    mocks.createClient.mockResolvedValue(client);
    mocks.createAdminClient.mockReturnValue(adminClient);

    const result = await submitVoiceRecordingArtifact({
      instanceId: INSTANCE_ID,
      blob: AUDIO_BYTES,
      mime: 'audio/webm',
      durationMs: 1200,
    });

    expect(result.success).toBe(true);
    expect(from).toHaveBeenCalledWith('activity_instances');
    expect(eq).toHaveBeenCalledWith('id', INSTANCE_ID);
    expect(eq).toHaveBeenCalledWith('assigned_to', STUDENT_ID);
    expect(eq).toHaveBeenCalledWith('type_id', 'voice-recording');
    expect(userUpdate).not.toHaveBeenCalled();
    expect(adminUpdate).toHaveBeenCalledWith({
      result_summary: {
        status: 'completed',
        artifactId: '99999999-9999-4999-8999-999999999999',
        durationMs: 1200,
      },
    });
    expect(mocks.advanceActivityCompletionProgress).toHaveBeenCalledWith(client, {
      activityInstanceId: INSTANCE_ID,
    });
    expect(mocks.recordChildArtifact).toHaveBeenCalledWith({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: AUDIO_BYTES, mime: 'audio/webm' },
      sourceRef: INSTANCE_ID,
      metadata: {
        activityInstanceId: INSTANCE_ID,
        activityTypeId: 'voice-recording',
        activityTitle: 'Înregistrare vocală',
        durationMs: 1200,
      },
    });
  });
});

function makeSupabaseClient({ instance }: { instance: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: instance, error: null });
  const userBuilder = {
    select: vi.fn(() => userBuilder),
    eq: vi.fn(() => userBuilder),
    update: vi.fn(() => userBuilder),
    maybeSingle,
  };
  const from = vi.fn(() => userBuilder);
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: STUDENT_ID } },
      }),
    },
    from,
  };
  const adminBuilder = {
    update: vi.fn(() => adminBuilder),
    eq: vi.fn(() => adminBuilder),
    then: (
      resolve: (value: { error: null }) => unknown,
      reject: (reason?: unknown) => unknown,
    ) => Promise.resolve({ error: null }).then(resolve, reject),
  };
  const adminClient = {
    from: vi.fn(() => adminBuilder),
  };

  return {
    client,
    adminClient,
    from,
    eq: userBuilder.eq,
    userUpdate: userBuilder.update,
    adminUpdate: adminBuilder.update,
    maybeSingle,
  };
}

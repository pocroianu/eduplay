import { beforeEach, describe, expect, it, vi } from 'vitest';

const runRecordChildArtifactMock = vi.fn();

vi.mock('../internal/run-record-artifact', () => ({
  runRecordChildArtifact: (...args: unknown[]) =>
    runRecordChildArtifactMock(...args),
}));

import { recordChildArtifact } from '../record-child-artifact';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const ARTIFACT_ID = '99999999-9999-4999-8999-999999999999';
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

const tinyAudio = (): Uint8Array => new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]);

beforeEach(() => {
  runRecordChildArtifactMock.mockReset();
  runRecordChildArtifactMock.mockResolvedValue({
    success: true,
    data: { artifactId: ARTIFACT_ID },
  });
});

describe('recordChildArtifact (drawing kind)', () => {
  it('forwards a validated drawing payload to the helper', async () => {
    const result = await recordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });
    expect(result.success).toBe(true);
    expect(runRecordChildArtifactMock).toHaveBeenCalledWith({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });
  });

  it('rejects a non-PNG dataURL before reaching the helper', async () => {
    const result = await recordChildArtifact({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: 'data:image/jpeg;base64,abc' },
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid studentId before reaching the helper', async () => {
    const result = await recordChildArtifact({
      kind: 'drawing',
      studentId: 'not-a-uuid',
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });
});

describe('recordChildArtifact (audio kind)', () => {
  it('forwards a validated audio payload to the helper', async () => {
    const blob = tinyAudio();
    const result = await recordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob, mime: 'audio/webm' },
      sourceRef: 'activity:voice-recorder/intro',
    });
    expect(result.success).toBe(true);
    expect(runRecordChildArtifactMock).toHaveBeenCalledTimes(1);
    const [forwarded] = runRecordChildArtifactMock.mock.calls[0];
    expect(forwarded.kind).toBe('audio');
    expect(forwarded.studentId).toBe(STUDENT_ID);
    expect(forwarded.sourceRef).toBe('activity:voice-recorder/intro');
    expect(forwarded.payload.mime).toBe('audio/webm');
    expect(forwarded.payload.blob).toBeInstanceOf(Uint8Array);
    expect(forwarded.payload.blob.byteLength).toBe(blob.byteLength);
  });

  it('rejects an unsupported audio MIME', async () => {
    const result = await recordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: tinyAudio(), mime: 'audio/mp4' },
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });

  it('rejects an oversize audio blob (>10 MB)', async () => {
    const oversize = new Uint8Array(10 * 1024 * 1024 + 1);
    const result = await recordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: oversize, mime: 'audio/webm' },
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });

  it('rejects an empty audio blob', async () => {
    const result = await recordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: new Uint8Array(0), mime: 'audio/webm' },
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });

  it('rejects a non-Uint8Array blob', async () => {
    const result = await recordChildArtifact({
      kind: 'audio',
      studentId: STUDENT_ID,
      payload: { blob: 'not-bytes', mime: 'audio/webm' },
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });
});

describe('recordChildArtifact (top-level rejections)', () => {
  it('rejects an unknown kind', async () => {
    const result = await recordChildArtifact({
      kind: 'video',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });

  it('rejects a missing kind', async () => {
    const result = await recordChildArtifact({
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const runRecordChildArtifactMock = vi.fn();

vi.mock('../internal/run-record-artifact', () => ({
  runRecordChildArtifact: (...args: unknown[]) =>
    runRecordChildArtifactMock(...args),
}));

import { recordGameArtifact } from '../record-game-artifact';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const GAME_ID = 'fruits-01';
const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

beforeEach(() => {
  runRecordChildArtifactMock.mockReset();
  runRecordChildArtifactMock.mockResolvedValue({
    success: true,
    data: { artifactId: '99999999-9999-4999-8999-999999999999' },
  });
});

describe('recordGameArtifact', () => {
  it('rejects an invalid payload before touching the storage layer', async () => {
    const result = await recordGameArtifact({
      studentId: 'not-a-uuid',
      gameId: GAME_ID,
      screenshotDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });

  it('rejects a non-PNG dataURL', async () => {
    const result = await recordGameArtifact({
      studentId: STUDENT_ID,
      gameId: GAME_ID,
      screenshotDataUrl: 'data:image/jpeg;base64,abc',
    });
    expect(result.success).toBe(false);
    expect(runRecordChildArtifactMock).not.toHaveBeenCalled();
  });

  it('forwards the game id as the source reference to the generalized helper', async () => {
    const result = await recordGameArtifact({
      studentId: STUDENT_ID,
      gameId: GAME_ID,
      screenshotDataUrl: TINY_PNG_DATA_URL,
    });
    expect(result.success).toBe(true);
    expect(runRecordChildArtifactMock).toHaveBeenCalledWith({
      kind: 'drawing',
      studentId: STUDENT_ID,
      payload: { dataUrl: TINY_PNG_DATA_URL },
      sourceRef: GAME_ID,
    });
  });
});

import { expect, it, vi } from 'vitest';
import { createFreeResponseSubmission, type FreeResponseInput, type SubmissionEffects } from './free-response-submission';

const input: FreeResponseInput = {
  activityId: 'activity', assignmentId: 'assignment', versionId: 'version', text: ' Answer ',
  strokes: [], drawingDataUrl: 'png', hasDrawingResponse: true, hasTextResponse: true,
  voiceBlob: new Blob(['voice']), voiceMime: 'audio/webm', voiceDurationMs: 50, retainExistingVoice: false,
};
function effects() {
  return {
    drawing: vi.fn<SubmissionEffects['drawing']>().mockResolvedValue('drawing'),
    voice: vi.fn<SubmissionEffects['voice']>().mockResolvedValue('voice'),
    commit: vi.fn<SubmissionEffects['commit']>().mockResolvedValue('submitted'),
    lookup: vi.fn<SubmissionEffects['lookup']>().mockResolvedValue(null),
    cleanup: vi.fn<SubmissionEffects['cleanup']>().mockResolvedValue(true),
  };
}
it('assembles mixed media and commits once through the workflow interface', async () => {
  const io = effects();
  expect(await createFreeResponseSubmission(io).submit(input)).toEqual({ kind: 'submitted' });
  expect(io.commit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ assignmentId: 'assignment' }), {
    text: 'Answer', drawing: { artifactId: 'drawing', state: { strokes: [] } },
    voice: { artifactId: 'voice', mime: 'audio/webm', durationMs: 50 }, artifacts: ['drawing', 'voice'],
  });
  expect(io.cleanup).not.toHaveBeenCalled();
});
it('awaits compensation after a failed second upload and never commits a partial response', async () => {
  const io = effects();
  io.voice.mockRejectedValue(new Error('offline'));
  expect(await createFreeResponseSubmission(io).submit(input)).toEqual({ kind: 'upload-failed' });
  expect(io.cleanup).toHaveBeenCalledWith(expect.anything(), ['drawing']);
  expect(io.commit).not.toHaveBeenCalled();
});
it('blocks new uploads until failed cleanup has actually succeeded', async () => {
  const io = effects();
  io.commit.mockResolvedValue('rejected');
  io.cleanup.mockResolvedValue(false);
  const workflow = createFreeResponseSubmission(io);
  expect(await workflow.submit(input)).toEqual({ kind: 'cleanup-failed' });
  expect(await workflow.submit(input)).toEqual({ kind: 'cleanup-failed' });
  expect(io.drawing).toHaveBeenCalledTimes(1);
  io.cleanup.mockResolvedValue(true);
  io.commit.mockResolvedValue('submitted');
  expect(await workflow.submit(input)).toEqual({ kind: 'submitted' });
});
it('preserves media after an uncertain commit and retries the exact response without reuploading', async () => {
  const io = effects();
  io.commit.mockResolvedValueOnce('unknown');
  const workflow = createFreeResponseSubmission(io);
  expect(await workflow.submit(input)).toEqual({ kind: 'uncertain' });
  expect(io.cleanup).not.toHaveBeenCalled();
  expect(await workflow.submit({ ...input, text: 'changed' })).toEqual({ kind: 'submitted' });
  expect(io.drawing).toHaveBeenCalledTimes(1);
  expect(io.voice).toHaveBeenCalledTimes(1);
  expect(io.commit.mock.calls[1][1]).toEqual(io.commit.mock.calls[0][1]);
});
it('reconciles a lost acknowledgement against the authoritative submitted response', async () => {
  const io = effects();
  io.commit.mockResolvedValue('unknown');
  io.lookup.mockResolvedValue({ status: 'submitted', latestResponse: { text: 'saved' } });
  expect(await createFreeResponseSubmission(io).submit(input)).toEqual({ kind: 'locked', latestResponse: { text: 'saved' } });
  expect(io.cleanup).not.toHaveBeenCalled();
});
it('coalesces overlapping submit clicks into one upload and commit', async () => {
  const io = effects();
  let release!: (id: string) => void;
  io.drawing.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const workflow = createFreeResponseSubmission(io);
  const first = workflow.submit(input);
  const second = workflow.submit(input);
  expect(second).toBe(first);
  await vi.waitFor(() => expect(io.drawing).toHaveBeenCalledTimes(1));
  release('drawing');
  await first;
  expect(io.commit).toHaveBeenCalledTimes(1);
});

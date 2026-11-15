export interface SubmissionTarget { activityId: string; assignmentId: string; versionId: string }
export interface FreeResponseInput extends SubmissionTarget {
  text: string;
  strokes: Array<{ points: Array<{ x: number; y: number }> }>;
  drawingDataUrl?: string | null;
  voiceBlob: Blob | null;
  voiceMime: 'audio/webm' | 'audio/ogg' | null;
  voiceDurationMs: number | null;
  hasTextResponse: boolean;
  hasDrawingResponse: boolean;
  retainExistingVoice: boolean;
}
export type SubmissionOutcome =
  | { kind: 'submitted' }
  | { kind: 'locked'; latestResponse: unknown }
  | { kind: 'upload-failed' | 'rejected' | 'uncertain' | 'cleanup-failed' };
export interface SubmissionEffects {
  drawing(input: FreeResponseInput): Promise<string>;
  voice(input: FreeResponseInput): Promise<string>;
  commit(target: SubmissionTarget, response: Record<string, unknown>): Promise<'submitted' | 'rejected' | 'unknown'>;
  lookup(target: SubmissionTarget): Promise<{ status: string; latestResponse: unknown } | null>;
  cleanup(target: SubmissionTarget, artifacts: string[]): Promise<boolean>;
}

function isLocked(status: string): boolean { return status === 'submitted' || status === 'approved'; }

/** Media capture stays outside. This module owns commit uncertainty and compensation. */
export function createFreeResponseSubmission(effects: SubmissionEffects) {
  let active: Promise<SubmissionOutcome> | null = null;
  let pending: { target: SubmissionTarget; response: Record<string, unknown> } | null = null;
  let cleanup: { target: SubmissionTarget; artifacts: string[] } | null = null;

  async function clean(): Promise<boolean> {
    if (!cleanup) return true;
    try {
      if (!await effects.cleanup(cleanup.target, cleanup.artifacts)) return false;
      cleanup = null;
      return true;
    } catch { return false; }
  }
  async function inspect(): Promise<SubmissionOutcome | null> {
    if (!pending) return null;
    try {
      const saved = await effects.lookup(pending.target);
      if (saved && isLocked(saved.status)) {
        pending = null;
        return { kind: 'locked', latestResponse: saved.latestResponse };
      }
    } catch { /* Uncertain commits retain their media and exact payload. */ }
    return null;
  }
  async function commit(retrying: boolean): Promise<SubmissionOutcome> {
    if (!pending) return { kind: 'rejected' };
    if (retrying) {
      const saved = await inspect();
      if (saved) return saved;
    }
    let result: 'submitted' | 'rejected' | 'unknown';
    try { result = await effects.commit(pending.target, pending.response); }
    catch { result = 'unknown'; }
    if (result === 'submitted') {
      pending = null;
      return { kind: 'submitted' };
    }
    if (result === 'unknown' || retrying) {
      const saved = await inspect();
      return saved ?? { kind: 'uncertain' };
    }
    pending = null;
    return await clean() ? { kind: 'rejected' } : { kind: 'cleanup-failed' };
  }
  async function run(input: FreeResponseInput): Promise<SubmissionOutcome> {
    if (pending) return commit(true);
    if (!await clean()) return { kind: 'cleanup-failed' };
    const target = { activityId: input.activityId, assignmentId: input.assignmentId, versionId: input.versionId };
    const artifacts: string[] = [];
    const response: Record<string, unknown> = {};
    try {
      if (input.hasTextResponse) response.text = input.text.trim();
      if (input.hasDrawingResponse) {
        const artifactId = await effects.drawing(input);
        artifacts.push(artifactId);
        response.drawing = { artifactId, state: { strokes: input.strokes } };
      }
      if (input.voiceBlob && input.voiceMime) {
        const artifactId = await effects.voice(input);
        artifacts.push(artifactId);
        response.voice = { artifactId, mime: input.voiceMime, durationMs: input.voiceDurationMs };
      } else if (input.retainExistingVoice) response.voice = { retained: true };
      if (artifacts.length) response.artifacts = artifacts;
    } catch {
      if (artifacts.length) cleanup = { target, artifacts };
      return await clean() ? { kind: 'upload-failed' } : { kind: 'cleanup-failed' };
    }
    if (artifacts.length) cleanup = { target, artifacts };
    pending = { target, response };
    const outcome = await commit(false);
    // Submitted media belongs to the submission, including an uncertain commit.
    if (outcome.kind === 'submitted' || outcome.kind === 'locked' || outcome.kind === 'uncertain') cleanup = null;
    return outcome;
  }
  return {
    submit(input: FreeResponseInput): Promise<SubmissionOutcome> {
      if (!active) active = run(input).finally(() => { active = null; });
      return active;
    },
  };
}

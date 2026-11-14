import { describe, expect, it } from 'vitest';
import {
  initialVoiceState,
  isPastHardCap,
  isPastSoftCap,
  isWarningCap,
  RECORDING_HARD_CAP_MS,
  RECORDING_SOFT_CAP_MS,
  RECORDING_WARN_AT_MS,
  voiceReducer,
  type VoiceState,
  type VoiceTake,
} from '../state-machine';

const sampleTake: VoiceTake = {
  blob: new Uint8Array([1, 2, 3]),
  mime: 'audio/webm',
  durationMs: 4_200,
};

function reduce(events: Parameters<typeof voiceReducer>[1][]): VoiceState {
  return events.reduce<VoiceState>(
    (state, event) => voiceReducer(state, event),
    initialVoiceState,
  );
}

describe('voiceReducer', () => {
  it('walks idle → requesting → recording → review → submitting → submitted', () => {
    const final = reduce([
      { type: 'start_pressed' },
      { type: 'permission_granted' },
      { type: 'tick', elapsedMs: 1_500 },
      { type: 'recording_stopped', take: sampleTake },
      { type: 'submit_pressed' },
      { type: 'submit_succeeded' },
    ]);
    expect(final.stage).toBe('submitted');
    expect(final.take).toEqual(sampleTake);
  });

  it('routes a denied permission into the permission_denied stage', () => {
    const final = reduce([
      { type: 'start_pressed' },
      { type: 'permission_denied' },
    ]);
    expect(final.stage).toBe('permission_denied');
  });

  it('routes an unsupported device into the device_unsupported stage from any stage', () => {
    const final = reduce([
      { type: 'start_pressed' },
      { type: 'device_unsupported' },
    ]);
    expect(final.stage).toBe('device_unsupported');
  });

  it('lets the student re-record from review back into requesting', () => {
    const final = reduce([
      { type: 'start_pressed' },
      { type: 'permission_granted' },
      { type: 'recording_stopped', take: sampleTake },
      { type: 're_record' },
    ]);
    expect(final.stage).toBe('requesting');
    expect(final.take).toBeNull();
  });

  it('surfaces a submit failure with the user-facing message and allows retry', () => {
    const failed = reduce([
      { type: 'start_pressed' },
      { type: 'permission_granted' },
      { type: 'recording_stopped', take: sampleTake },
      { type: 'submit_pressed' },
      { type: 'submit_failed', message: 'Eroare retea' },
    ]);
    expect(failed.stage).toBe('submit_error');
    expect(failed.errorMessage).toBe('Eroare retea');

    const retried = voiceReducer(failed, { type: 're_record' });
    expect(retried.stage).toBe('requesting');
  });

  it('lets the student retry submit after a failed submit without re-recording', () => {
    const failed = reduce([
      { type: 'start_pressed' },
      { type: 'permission_granted' },
      { type: 'recording_stopped', take: sampleTake },
      { type: 'submit_pressed' },
      { type: 'submit_failed', message: 'Eroare retea' },
    ]);

    const retrying = voiceReducer(failed, { type: 'submit_pressed' });
    expect(retrying.stage).toBe('submitting');
    expect(retrying.take).toEqual(sampleTake);
    expect(retrying.errorMessage).toBeNull();

    expect(voiceReducer(retrying, { type: 'submit_succeeded' }).stage).toBe(
      'submitted',
    );
  });

  it('ignores unrelated events for the current stage', () => {
    const final = reduce([
      { type: 'start_pressed' },
      // tick before recording does nothing
      { type: 'tick', elapsedMs: 999 },
    ]);
    expect(final.stage).toBe('requesting');
    expect(final.elapsedMs).toBe(0);
  });

  it('cap helpers identify warning, soft-cap, and hard-cap bands', () => {
    expect(isWarningCap(RECORDING_WARN_AT_MS - 1)).toBe(false);
    expect(isWarningCap(RECORDING_WARN_AT_MS)).toBe(true);
    expect(isWarningCap(RECORDING_SOFT_CAP_MS - 1)).toBe(true);
    expect(isWarningCap(RECORDING_SOFT_CAP_MS)).toBe(false);

    expect(isPastSoftCap(RECORDING_SOFT_CAP_MS - 1)).toBe(false);
    expect(isPastSoftCap(RECORDING_SOFT_CAP_MS)).toBe(true);

    expect(isPastHardCap(RECORDING_HARD_CAP_MS - 1)).toBe(false);
    expect(isPastHardCap(RECORDING_HARD_CAP_MS)).toBe(true);
  });
});

/**
 * State machine for the voice-recording renderer. Pure (no DOM, no React)
 * so unit tests can exhaustively walk transitions without a JSDOM harness.
 *
 * Stages:
 *   - `idle`               — pre-permission CTA visible.
 *   - `requesting`         — `getUserMedia` in flight.
 *   - `permission_denied`  — user blocked the mic permission.
 *   - `device_unsupported` — neither preferred Opus container is supported.
 *   - `recording`          — `MediaRecorder` is active.
 *   - `review`             — a take exists; can play / re-record / submit.
 *   - `submitting`         — handing the blob to `recordChildArtifact`.
 *   - `submitted`          — write succeeded; renderer is winding down.
 *   - `submit_error`       — write failed; allow retry.
 *
 * Caps:
 *   - Soft cap at 60 s — UI shows a visual cue at 50 s (warning indicator).
 *   - Hard cap at 90 s — recorder is force-stopped at the boundary.
 */

export const RECORDING_SOFT_CAP_MS = 60_000;
export const RECORDING_WARN_AT_MS = 50_000;
export const RECORDING_HARD_CAP_MS = 90_000;

export type VoiceStage =
  | 'idle'
  | 'requesting'
  | 'permission_denied'
  | 'device_unsupported'
  | 'recording'
  | 'review'
  | 'submitting'
  | 'submitted'
  | 'submit_error';

export interface VoiceTake {
  /** The recorded audio bytes; `Uint8Array` to match the action contract. */
  blob: Uint8Array;
  mime: 'audio/webm' | 'audio/ogg';
  /** Length of the recording in milliseconds. */
  durationMs: number;
}

export interface VoiceState {
  stage: VoiceStage;
  /** Elapsed recording time in ms when stage === 'recording'; otherwise 0. */
  elapsedMs: number;
  /** The current take. Set on `recording_stopped`, cleared on `re_record`. */
  take: VoiceTake | null;
  /** User-friendly Romanian error string when stage === 'submit_error'. */
  errorMessage: string | null;
}

export type VoiceEvent =
  | { type: 'start_pressed' }
  | { type: 'permission_granted' }
  | { type: 'permission_denied' }
  | { type: 'device_unsupported' }
  | { type: 'tick'; elapsedMs: number }
  | { type: 'recording_stopped'; take: VoiceTake }
  | { type: 're_record' }
  | { type: 'submit_pressed' }
  | { type: 'submit_succeeded' }
  | { type: 'submit_failed'; message: string };

export const initialVoiceState: VoiceState = {
  stage: 'idle',
  elapsedMs: 0,
  take: null,
  errorMessage: null,
};

export function voiceReducer(
  state: VoiceState,
  event: VoiceEvent,
): VoiceState {
  switch (event.type) {
    case 'start_pressed': {
      if (state.stage !== 'idle' && state.stage !== 'permission_denied') {
        return state;
      }
      return {
        stage: 'requesting',
        elapsedMs: 0,
        take: null,
        errorMessage: null,
      };
    }
    case 'permission_granted': {
      if (state.stage !== 'requesting') return state;
      return { ...state, stage: 'recording', elapsedMs: 0, take: null };
    }
    case 'permission_denied': {
      if (state.stage !== 'requesting') return state;
      return {
        stage: 'permission_denied',
        elapsedMs: 0,
        take: null,
        errorMessage: null,
      };
    }
    case 'device_unsupported': {
      return {
        stage: 'device_unsupported',
        elapsedMs: 0,
        take: null,
        errorMessage: null,
      };
    }
    case 'tick': {
      if (state.stage !== 'recording') return state;
      return { ...state, elapsedMs: event.elapsedMs };
    }
    case 'recording_stopped': {
      if (state.stage !== 'recording') return state;
      return {
        stage: 'review',
        elapsedMs: 0,
        take: event.take,
        errorMessage: null,
      };
    }
    case 're_record': {
      if (state.stage !== 'review' && state.stage !== 'submit_error') {
        return state;
      }
      return {
        stage: 'requesting',
        elapsedMs: 0,
        take: null,
        errorMessage: null,
      };
    }
    case 'submit_pressed': {
      if (
        (state.stage !== 'review' && state.stage !== 'submit_error') ||
        !state.take
      ) {
        return state;
      }
      return { ...state, stage: 'submitting', errorMessage: null };
    }
    case 'submit_succeeded': {
      if (state.stage !== 'submitting') return state;
      return { ...state, stage: 'submitted', errorMessage: null };
    }
    case 'submit_failed': {
      if (state.stage !== 'submitting') return state;
      return { ...state, stage: 'submit_error', errorMessage: event.message };
    }
    default:
      return state;
  }
}

/** Whether the recorder should be in the warning band (≥ 50 s, < 60 s). */
export function isWarningCap(elapsedMs: number): boolean {
  return elapsedMs >= RECORDING_WARN_AT_MS && elapsedMs < RECORDING_SOFT_CAP_MS;
}

/** Whether the recorder has crossed the soft cap (≥ 60 s). */
export function isPastSoftCap(elapsedMs: number): boolean {
  return elapsedMs >= RECORDING_SOFT_CAP_MS;
}

/** Whether the recorder must be force-stopped (≥ 90 s). */
export function isPastHardCap(elapsedMs: number): boolean {
  return elapsedMs >= RECORDING_HARD_CAP_MS;
}

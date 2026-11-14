import { z } from 'zod';
import type { ActivityTypeDefinition } from '../../types';
import {
  VoiceRecorderRenderer,
  type VoiceRecordingConfig,
  type VoiceRecordingResult,
} from './VoiceRecorderRenderer';

const VOICE_RECORDING_TYPE_ID = 'voice-recording';

export const voiceRecordingConfigSchema = z.object({
  promptText: z.string().trim().min(1).max(280).optional(),
});

/**
 * Sentinel `RecordArtifactInput` returned by `voiceRecordingType.resultCollector`.
 *
 * The renderer writes the artifact directly via `recordChildArtifact` (the
 * audio path needs the decoded `Uint8Array`), so the shell's
 * `resultCollector` slot is not the persistence path here. A throw would
 * silently break any shell that calls it without reading the JSDoc; instead
 * we return a deliberately-bogus shape that:
 *   - has a zero `studentId` (UUID NIL) — guaranteed RLS denial if a future
 *     shell tries to insert with these values, so a misuse fails *loud* and
 *     observable rather than appearing to succeed,
 *   - carries the unmistakable `__voice-recording-self-persisted__`
 *     storage path so logs / DB scans can grep for the contract violation,
 *   - keeps the `artifactType: 'audio'` so any future shell that reads
 *     this for routing rather than write doesn't misclassify the take.
 *
 * Future shells should detect this sentinel (or, better, switch to a
 * `selfPersists: true` flag on `ActivityTypeDefinition`) and skip the
 * post-completion write rather than treat the value as a real input.
 * Tracked as a foundation follow-up; out of scope for EDU-295.
 */
const VOICE_RECORDING_SELF_PERSISTED_PATH =
  '__voice-recording-self-persisted__';

/**
 * `voice-recording` activity type registration.
 *
 * Persistence note: the renderer writes the artifact directly via
 * `recordChildArtifact({ kind: 'audio' })` because the audio path needs the
 * decoded `Uint8Array`. The shell's `resultCollector` slot is therefore not
 * the persistence path here — see `VOICE_RECORDING_SELF_PERSISTED_PATH` for
 * the sentinel behavior if a future shell calls it anyway.
 */
export const voiceRecordingType: ActivityTypeDefinition<
  VoiceRecordingConfig,
  VoiceRecordingResult
> = {
  typeId: VOICE_RECORDING_TYPE_ID,
  displayName: 'Înregistrează-ți vocea',
  icon: 'Microphone',
  configSchema: voiceRecordingConfigSchema,
  RendererComponent: VoiceRecorderRenderer,
  resultCollector: async () => ({
    studentId: '00000000-0000-0000-0000-000000000000',
    classId: null,
    artifactType: 'audio',
    storagePath: VOICE_RECORDING_SELF_PERSISTED_PATH,
    title: '[handled by renderer — see VOICE_RECORDING_SELF_PERSISTED_PATH]',
  }),
  requiredConsent: 'audio_recording',
};


export type { VoiceRecordingConfig, VoiceRecordingResult } from './VoiceRecorderRenderer';

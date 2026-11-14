import type { AudioMimeType } from '@/features/portfolio';

/**
 * Codec preference. WebM/Opus is the modern Chromium/Firefox/Edge target;
 * we fall through to Ogg/Opus on engines that ship Opus only via Ogg.
 * Both formats are accepted by `recordChildArtifact` and by the
 * `child-artifacts` storage bucket's MIME allow-list.
 */
const PREFERRED_RECORDER_MIMES: ReadonlyArray<{
  mime: AudioMimeType;
  codec: string;
}> = [
  { mime: 'audio/webm', codec: 'audio/webm;codecs=opus' },
  { mime: 'audio/ogg', codec: 'audio/ogg;codecs=opus' },
];

export interface ResolvedRecorderMime {
  /** Bucket-allow-listed parent MIME stored on the artifact row. */
  mime: AudioMimeType;
  /** Full type-with-codec string handed to `new MediaRecorder`. */
  recorderType: string;
}

/**
 * Probes a `MediaRecorder.isTypeSupported`-shaped predicate and returns
 * the first preferred Opus container the runtime supports. Returns null
 * when the device offers neither — the renderer maps that to a graceful
 * "device not supported" empty state.
 *
 * Pure helper (no DOM) so it can be unit-tested with a stub predicate.
 */
export function pickRecorderMime(
  isTypeSupported: (type: string) => boolean,
): ResolvedRecorderMime | null {
  for (const candidate of PREFERRED_RECORDER_MIMES) {
    if (isTypeSupported(candidate.codec)) {
      return { mime: candidate.mime, recorderType: candidate.codec };
    }
  }
  return null;
}

/** Re-export so renderer + tests share the canonical MIME list. */
export type { AudioMimeType };

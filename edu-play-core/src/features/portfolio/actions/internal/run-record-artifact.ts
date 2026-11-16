// Internal helper for `recordChildArtifact` and Activity artifact wrappers.
// Kept outside any `'use server'` file so it isn't exposed as a public RPC endpoint.

import 'server-only';
import { ApiError, requireRole } from '@/lib/api';
import { persistDraftArtifact } from './persist-draft-artifact';
import type { AudioMimeType, RecordChildArtifactInput } from '../../schemas';
import { MAX_AUDIO_BYTES, MAX_SCREENSHOT_BYTES } from '../../schemas';
import type { ActionResult, ArtifactType } from '../../types';

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';
const PNG_CONTENT_TYPE = 'image/png';

// Standard base64 (no URL-safe `-`/`_`); '=' padding only at the tail.
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

// PNG signature per RFC 2083 §3.1: \x89 P N G \r \n \x1a \n
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

const AUDIO_EXTENSION_BY_MIME: Record<AudioMimeType, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

export interface RecordChildArtifactData {
  artifactId: string;
}

interface DecodedPayload {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  artifactType: ArtifactType;
}

interface StudentArtifactContext {
  class_id: string | null;
  consents?: unknown;
}

function hasAudioRecordingConsent(consents: unknown): boolean {
  return (
    !!consents &&
    typeof consents === 'object' &&
    !Array.isArray(consents) &&
    (consents as Record<string, unknown>).audio_recording === true
  );
}

/**
 * Decodes a `data:image/png;base64,...` URL into raw bytes. Returns null on
 * malformed input, oversize payloads, or anything whose decoded bytes don't
 * begin with the PNG signature (treated as caller error).
 *
 * Node's `Buffer.from(s, 'base64')` is permissive — it silently strips
 * invalid characters and ignores incorrect padding — so we gate on a strict
 * regex and the file's magic bytes before handing the buffer to storage.
 */
function decodePngDataUrl(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) return null;
  const base64 = dataUrl.slice(PNG_DATA_URL_PREFIX.length);
  if (base64.length === 0 || base64.length % 4 !== 0) return null;
  if (!BASE64_PATTERN.test(base64)) return null;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
  if (buffer.byteLength <= PNG_SIGNATURE.length) return null;
  if (buffer.byteLength > MAX_SCREENSHOT_BYTES) return null;
  if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return null;
  }
  return buffer;
}

export function decodeArtifactPayload(input: RecordChildArtifactInput): DecodedPayload | null {
  if (input.kind === 'drawing') {
    const bytes = decodePngDataUrl(input.payload.dataUrl);
    if (!bytes) return null;
    return {
      bytes,
      contentType: PNG_CONTENT_TYPE,
      extension: 'png',
      artifactType: 'drawing',
    };
  }

  if (input.kind === 'audio') {
    // The schema enforces instanceof Uint8Array, a non-zero byte length,
    // the size cap, and the MIME enum — re-check here so a caller that
    // bypassed schema validation gets a clean rejection rather than a
    // confusing storage-layer error.
    const { blob, mime } = input.payload;
    if (
      !(blob instanceof Uint8Array) ||
      blob.byteLength === 0 ||
      blob.byteLength > MAX_AUDIO_BYTES
    ) {
      return null;
    }
    const extension = AUDIO_EXTENSION_BY_MIME[mime];
    if (!extension) return null;
    return {
      bytes: blob,
      contentType: mime,
      extension,
      artifactType: 'audio',
    };
  }

  return null;
}

export async function runRecordChildArtifact(
  input: RecordChildArtifactInput & { metadata?: Record<string, unknown> },
): Promise<ActionResult<RecordChildArtifactData>> {
  let supabase;
  let actorId: string;
  try {
    const ctx = await requireRole('student');
    supabase = ctx.supabase;
    actorId = ctx.user.id;
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        success: false,
        error:
          err.code === 'FORBIDDEN'
            ? 'Doar elevii pot înregistra artefacte'
            : 'Nu ești autentificat',
      };
    }
    throw err;
  }

  // Defense-in-depth: the storage RLS already requires the path to begin
  // with `auth.uid()`, but we reject mismatched studentIds upfront with a
  // clear error rather than relying solely on a generic upload failure.
  if (input.studentId !== actorId) {
    return {
      success: false,
      error: 'Nu ai permisiunea să încarci pentru acest elev',
    };
  }

  const decoded = decodeArtifactPayload(input);
  if (!decoded) {
    let error: string;
    if (input.kind === 'drawing') {
      error = 'Captura de ecran este invalidă sau prea mare';
    } else if (input.kind === 'audio') {
      error = 'Înregistrarea audio este invalidă sau prea mare';
    } else {
      error = 'Tipul de artefact nu este acceptat pentru acest flux';
    }
    return { success: false, error };
  }

  // Look up the student's class enrollment so the artifact lands inside the
  // teacher review queue. The teacher SELECT/UPDATE policy on `child_artifacts`
  // is gated on `class_id IN (SELECT get_teacher_class_ids(auth.uid()))`, so
  // a draft inserted with `class_id: null` is invisible to teachers and can
  // never leave draft. Students RLS on `students` allows self-row read.
  const { data: rawStudentRow, error: studentLookupError } = await supabase
    .from('students')
    .select('class_id, consents')
    .eq('id', actorId)
    .maybeSingle();
  const studentRow = rawStudentRow as StudentArtifactContext | null;

  if (studentLookupError) {
    return {
      success: false,
      error: 'Nu am putut găsi clasa elevului',
    };
  }

  if (
    input.kind === 'audio' &&
    !hasAudioRecordingConsent(studentRow?.consents)
  ) {
    return {
      success: false,
      error: 'Avem nevoie de acordul părintelui pentru înregistrări audio',
    };
  }

  // No class enrollment → still record the draft (student can review their own
  // copy), but it won't surface in any teacher queue until they're assigned a
  // class. Document this as expected, not an error.
  const artifactClassId = studentRow?.class_id ?? null;

  const result = await persistDraftArtifact(supabase, {
    ...decoded,
    studentId: input.studentId,
    classId: artifactClassId,
    metadata: {
      ...(input.sourceRef ? { sourceRef: input.sourceRef } : {}),
      ...(input.metadata ?? {}),
    },
  });
  if (!result.success) {
    let error = 'Nu am putut înregistra artefactul';
    if (result.stage === 'upload') {
      error =
        input.kind === 'drawing'
          ? 'Nu am putut salva captura de ecran'
          : 'Nu am putut salva înregistrarea audio';
    }
    return { success: false, error };
  }

  return {
    success: true,
    data: { artifactId: result.artifactId },
  };
}

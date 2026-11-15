// Internal helper for `teacherUploadArtifact`. Kept outside any
// `'use server'` file so it isn't exposed as a public RPC endpoint.

import 'server-only';
import { ApiError, requireRole } from '@/lib/api';
import { persistDraftArtifact } from './persist-draft-artifact';
import type {
  AudioMimeType,
  PhotoMimeType,
  TeacherUploadArtifactInput,
} from '../../schemas';
import { MAX_AUDIO_BYTES, MAX_PHOTO_BYTES } from '../../schemas';
import type { ActionResult, ArtifactType } from '../../types';

const PHOTO_EXTENSION_BY_MIME: Record<PhotoMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] as const;

const AUDIO_EXTENSION_BY_MIME: Record<AudioMimeType, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

export interface TeacherUploadArtifactData {
  artifactId: string;
}

interface DecodedPayload {
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  artifactType: ArtifactType;
}

function hasSignature(
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0,
): boolean {
  if (bytes.byteLength < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function hasPhotoSignature(bytes: Uint8Array, mime: PhotoMimeType): boolean {
  if (mime === 'image/jpeg') {
    return hasSignature(bytes, JPEG_SIGNATURE);
  }

  return (
    hasSignature(bytes, RIFF_SIGNATURE) &&
    hasSignature(bytes, WEBP_SIGNATURE, 8)
  );
}

function decodePayload(
  input: TeacherUploadArtifactInput,
): DecodedPayload | null {
  if (input.kind === 'photo') {
    const { blob, mime } = input.payload;
    if (
      !(blob instanceof Uint8Array) ||
      blob.byteLength === 0 ||
      blob.byteLength > MAX_PHOTO_BYTES ||
      !hasPhotoSignature(blob, mime)
    ) {
      return null;
    }
    const extension = PHOTO_EXTENSION_BY_MIME[mime];
    if (!extension) return null;
    return {
      bytes: blob,
      contentType: mime,
      extension,
      artifactType: 'photo',
    };
  }

  // Audio. Schema enforces instanceof Uint8Array, byte cap, and MIME enum;
  // re-check here so a caller that bypassed schema validation gets a clean
  // rejection rather than a confusing storage-layer error.
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

export async function runTeacherUploadArtifact(
  input: TeacherUploadArtifactInput,
): Promise<ActionResult<TeacherUploadArtifactData>> {
  let supabase;
  try {
    const ctx = await requireRole('teacher');
    supabase = ctx.supabase;
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        success: false,
        error:
          err.code === 'FORBIDDEN'
            ? 'Doar profesorii pot încărca artefacte'
            : 'Nu ești autentificat',
      };
    }
    throw err;
  }

  const decoded = decodePayload(input);
  if (!decoded) {
    return {
      success: false,
      error:
        input.kind === 'photo'
          ? 'Fotografia este invalidă sau prea mare'
          : 'Înregistrarea audio este invalidă sau prea mare',
    };
  }

  // Resolve the student's class via the teacher session client. The
  // `students` SELECT policy gates by `class_id IN get_teacher_class_ids`,
  // so a row only comes back when the requested student is in one of this
  // teacher's classes. A missing row OR a null `class_id` means the
  // teacher has no claim on this student — deny outright instead of
  // recording an orphan draft. (`class_id` cannot be null and pass RLS
  // anyway, but we still null-guard for clarity.)
  const { data: studentRow, error: studentLookupError } = await supabase
    .from('students')
    .select('class_id')
    .eq('id', input.studentId)
    .maybeSingle();

  if (studentLookupError) {
    return {
      success: false,
      error: 'Nu am putut găsi clasa elevului',
    };
  }

  if (!studentRow?.class_id) {
    return {
      success: false,
      error: 'Nu ai permisiunea să încarci pentru acest elev',
    };
  }

  const artifactClassId = studentRow.class_id;

  const result = await persistDraftArtifact(supabase, {
    ...decoded,
    studentId: input.studentId,
    classId: artifactClassId,
    title: input.title?.trim() || null,
  });
  if (!result.success) {
    let error = 'Nu am putut înregistra artefactul';
    if (result.stage === 'upload') {
      error =
        input.kind === 'photo'
          ? 'Nu am putut salva fotografia'
          : 'Nu am putut salva înregistrarea audio';
    }
    return { success: false, error };
  }

  return {
    success: true,
    data: { artifactId: result.artifactId },
  };
}

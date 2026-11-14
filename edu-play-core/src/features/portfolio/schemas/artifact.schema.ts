import { z } from 'zod';
import { ARTIFACT_TYPES, ARTIFACT_VISIBILITIES } from '../types';
import type { Artifact } from '../types';

const uuid = z.string().uuid('ID-ul artefactului este invalid');

/**
 * Row schema for `child_artifacts` keyed in the camelCase entity shape
 * exposed by feature queries (i.e., post-`camelCaseKeys`). Mirrors the
 * `Artifact` TypeScript type so a drift between the live DB schema and
 * the typed API surface fails loud at the parseRows boundary instead of
 * silently flowing through to consumers.
 *
 * `artifact_type` and `visibility` are CHECK-constrained at the DB level,
 * so we keep them as enums here. Everything else stays permissive (free
 * strings, nullable timestamps) per the EDU-34 row-schema convention.
 */
export const artifactRowSchema = z.object({
  id: uuid,
  studentId: uuid,
  classId: uuid.nullable(),
  title: z.string().nullable(),
  artifactType: z.enum(ARTIFACT_TYPES),
  storagePath: z.string(),
  visibility: z.enum(ARTIFACT_VISIBILITIES),
  reviewedBy: uuid.nullable(),
  reviewedAt: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<Artifact>;

export type ArtifactRowSchema = z.infer<typeof artifactRowSchema>;

/**
 * Schema for inserting a new artifact. New artifacts always start at
 * `visibility: 'draft'`; the table default also enforces this. We accept
 * the field optionally so callers can be explicit, but we reject any
 * non-draft initial value here as a defense-in-depth check on top of RLS.
 */
export const createArtifactSchema = z.object({
  studentId: uuid,
  classId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(120).nullable().optional(),
  artifactType: z.enum(ARTIFACT_TYPES),
  storagePath: z.string().min(1, 'Calea de stocare este obligatorie'),
  visibility: z.literal('draft').optional(),
});

export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;

/**
 * Schema for updating mutable artifact metadata. Visibility transitions go
 * through `setArtifactVisibilitySchema` so the audit trigger captures them
 * cleanly; this schema covers everything else.
 */
export const updateArtifactSchema = z.object({
  id: uuid,
  title: z.string().trim().min(1).max(120).nullable().optional(),
  classId: uuid.nullable().optional(),
});

export type UpdateArtifactInput = z.infer<typeof updateArtifactSchema>;

/**
 * Schema for visibility transitions. Server actions use this to validate
 * the requested lifecycle move before writing. Transition rules
 * (e.g. who may publish vs archive) are enforced in the action layer plus
 * RLS — this schema only validates shape.
 */
export const setArtifactVisibilitySchema = z.object({
  id: uuid,
  visibility: z.enum(ARTIFACT_VISIBILITIES),
});

export type SetArtifactVisibilityInput = z.infer<
  typeof setArtifactVisibilitySchema
>;

/**
 * Maximum decoded PNG size we accept from a game completion or drawing
 * canvas. 5 MB is well above what a 1280x720 canvas produces (typically
 * <1 MB) but caps abuse. The dataURL prefix is stripped before decoding;
 * this limit applies to the resulting binary, not the base64 string.
 *
 * Server Action wire size is `MAX_SCREENSHOT_BYTES` × 4/3 (base64) plus the
 * dataURL prefix and request framing — keep
 * `experimental.serverActions.bodySizeLimit` in `next.config.ts` above the
 * resulting figure so valid screenshots reach the action instead of being
 * rejected by Next.js up-front.
 */
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

/**
 * Maximum size for a recorded audio blob (10 MB). At ~24 kbps Opus this
 * comfortably fits the F9 voice-recorder cap of 60s and leaves headroom
 * for higher-quality WebM recordings on devices that default to a richer
 * codec profile.
 *
 * Audio is sent as a `Uint8Array` (binary, ~1:1 wire size) — keep
 * `experimental.serverActions.bodySizeLimit` in `next.config.ts` above
 * `MAX_AUDIO_BYTES` so legitimate recordings aren't rejected by the
 * framework before the action runs.
 */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Maximum size for a teacher-uploaded photo (8 MB). Phone cameras at full
 * resolution + JPEG quality 0.9 land between 2-6 MB; 8 MB caps oversized
 * RAW exports without rejecting day-to-day classroom snapshots.
 *
 * Photos are sent as a `Uint8Array` (binary, ~1:1 wire size) — keep
 * `experimental.serverActions.bodySizeLimit` in `next.config.ts` above
 * `MAX_PHOTO_BYTES` so legitimate uploads aren't rejected by the
 * framework before the action runs. The current 12 MB limit comfortably
 * covers MAX_AUDIO_BYTES (10 MB) and MAX_PHOTO_BYTES (8 MB) plus
 * Server Action argument framing.
 */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * Audio MIME types accepted by the voice-recorder activity. The bucket
 * `allowed_mime_types` is locked to the same list (see migration
 * `20260501010000_child_artifacts_bucket_mime_types.sql`) so callers
 * cannot smuggle other formats past the action.
 */
export const AUDIO_MIME_TYPES = ['audio/webm', 'audio/ogg'] as const;
export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number];

/**
 * Photo MIME types accepted by the teacher upload action (F6 Phase 2A).
 * PNG stays the drawing path (game canvas screenshots), so it's not in
 * this list. The bucket allow-list mirrors these entries — see migration
 * `20260508000000_teacher_child_artifact_uploads.sql`.
 */
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/webp'] as const;
export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

const MAX_SCREENSHOT_DATA_URL_LENGTH =
  PNG_DATA_URL_PREFIX.length + Math.ceil((MAX_SCREENSHOT_BYTES * 4) / 3) + 4;

const screenshotDataUrlSchema = z
  .string()
  .max(
    MAX_SCREENSHOT_DATA_URL_LENGTH,
    'Capturarea ecranului depășește dimensiunea permisă',
  )
  .refine(
    (value) => value.startsWith(PNG_DATA_URL_PREFIX),
    'Formatul capturii de ecran este invalid (PNG dataURL așteptat)',
  );

/**
 * Schema for `recordActivityArtifact`. Accepts a PNG dataURL captured from the
 * Activity renderer canvas and the IDs needed to attribute the artifact. The
 * student id is re-checked against the authenticated session inside the action
 * — we still validate the shape here to fail fast on malformed callers.
 */
export const recordActivityArtifactSchema = z.object({
  studentId: uuid,
  activityId: uuid,
  versionId: uuid.optional(),
  assignmentId: uuid.optional(),
  screenshotDataUrl: screenshotDataUrlSchema,
  score: z.number().int().min(0).max(100).optional(),
});

export type RecordActivityArtifactInput = z.infer<typeof recordActivityArtifactSchema>;

const sourceRefSchema = z
  .string()
  .min(1, 'sourceRef nu poate fi gol')
  .max(120, 'sourceRef depășește lungimea permisă');

/**
 * Legacy game-completion wrapper input. `gameId` is intentionally an opaque
 * source reference rather than a UUID because older iframe messages can use
 * renderer/catalog slugs.
 */
export const recordGameArtifactSchema = z.object({
  studentId: uuid,
  gameId: sourceRefSchema,
  screenshotDataUrl: screenshotDataUrlSchema,
});

export type RecordGameArtifactInput = z.infer<typeof recordGameArtifactSchema>;

const artifactMetadataSchema = z.record(z.string(), z.unknown());

const drawingPayloadSchema = z.object({
  dataUrl: screenshotDataUrlSchema,
});

/**
 * `Uint8Array` accepted via `z.custom` because Zod has no built-in for it
 * and Server Actions serialize Buffer as Uint8Array on the server side.
 * The byte-length cap also lives here so the action layer never sees an
 * oversize blob; the storage `file_size_limit` is the second line.
 */
const audioPayloadSchema = z.object({
  blob: z
    .custom<Uint8Array>(
      (value) => value instanceof Uint8Array,
      'Înregistrarea audio este invalidă',
    )
    .refine(
      (value) => value.byteLength > 0,
      'Înregistrarea audio este goală',
    )
    .refine(
      (value) => value.byteLength <= MAX_AUDIO_BYTES,
      'Înregistrarea audio depășește dimensiunea permisă',
    ),
  mime: z.enum(AUDIO_MIME_TYPES, {
    message: 'Formatul audio nu este acceptat',
  }),
});

/**
 * Photo payload for teacher-authored uploads. Mirrors the audio payload
 * shape: Uint8Array bytes plus a MIME enum. PNG stays in the drawing path
 * (it carries a base64 dataURL and goes through the canvas signature
 * check), so it is intentionally not accepted here.
 */
const photoPayloadSchema = z.object({
  blob: z
    .custom<Uint8Array>(
      (value) => value instanceof Uint8Array,
      'Fotografia este invalidă',
    )
    .refine(
      (value) => value.byteLength > 0,
      'Fotografia este goală',
    )
    .refine(
      (value) => value.byteLength <= MAX_PHOTO_BYTES,
      'Fotografia depășește dimensiunea permisă',
    ),
  mime: z.enum(PHOTO_MIME_TYPES, {
    message: 'Formatul fotografiei nu este acceptat',
  }),
});

/**
 * Discriminated-union schema for `recordChildArtifact`. Each `kind`
 * carries its own `payload` shape so the action can fan out to the
 * appropriate storage path without a runtime cast.
 *
 * - `kind: 'drawing'` — PNG dataURL produced by a game canvas screenshot
 *   (existing F6 path) or the F9 drawing-canvas activity.
 * - `kind: 'audio'`   — recorded audio blob (Uint8Array) from the F9
 *   voice-recorder activity, with the MIME negotiated client-side.
 *
 * Teacher-authored photos use `teacherUploadArtifactSchema` instead. Keeping
 * photo out of this schema ensures `recordChildArtifact` accepts only the
 * kinds its student-side runner can actually persist.
 *
 * `sourceRef` is an opaque caller-supplied identifier (game id, activity
 * instance id, etc.) used to attribute the artifact. It is intentionally
 * not stored in `child_artifacts` today — keeping it in the schema lets
 * us thread it into a follow-up `metadata` column without changing the
 * public contract.
 */
export const recordChildArtifactSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('drawing'),
    studentId: uuid,
    payload: drawingPayloadSchema,
    sourceRef: sourceRefSchema.optional(),
    metadata: artifactMetadataSchema.optional(),
  }),
  z.object({
    kind: z.literal('audio'),
    studentId: uuid,
    payload: audioPayloadSchema,
    sourceRef: sourceRefSchema.optional(),
    metadata: artifactMetadataSchema.optional(),
  }),
]);

export type RecordChildArtifactInput = z.infer<
  typeof recordChildArtifactSchema
>;
export type RecordChildArtifactKind = RecordChildArtifactInput['kind'];

const teacherTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(120, 'Titlul depășește lungimea permisă');

/**
 * Schema for `teacherUploadArtifact`. The teacher action accepts only the
 * media kinds a teacher can author client-side today — `photo` and
 * `audio`. The `drawing` kind stays student-only because it carries the
 * PNG dataURL that the canvas activity produces; teachers don't have a UI
 * for that path.
 *
 * Title is optional and trimmed to 120 chars to match
 * `updateArtifactSchema`. Storage path / class resolution happens in the
 * action layer; the schema is shape-only.
 */
export const teacherUploadArtifactSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('photo'),
    studentId: uuid,
    payload: photoPayloadSchema,
    title: teacherTitleSchema.optional(),
  }),
  z.object({
    kind: z.literal('audio'),
    studentId: uuid,
    payload: audioPayloadSchema,
    title: teacherTitleSchema.optional(),
  }),
]);

export type TeacherUploadArtifactInput = z.infer<
  typeof teacherUploadArtifactSchema
>;
export type TeacherUploadArtifactKind = TeacherUploadArtifactInput['kind'];

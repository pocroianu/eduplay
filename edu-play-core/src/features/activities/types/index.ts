// Activities Feature - Shared Types
//
// Mirrors the `activity_instances` table from migration 20260501100000.
// The catalog of types (drawing canvas, voice recording, ...) is code-side
// via `features/activities/registry`; this module stores the per-student
// instances that students play and that teachers later attach artifacts to.

import type { ComponentType } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { z, ZodTypeAny } from 'zod';
import type { IconName } from '@/shared/components/ui/Icon.registry';
import type { Database } from '@/shared/types/database';

/**
 * Camel-cased shape returned by feature queries. The DB row uses snake_case;
 * queries normalize on read so callers never see DB casing.
 *
 * `resultSummary` is the durable per-instance outcome bag (final artifact id,
 * completion time, attempts, etc.) populated by activity types in 1B/1C —
 * stored as JSONB so each type owns its own shape under a registry-scoped
 * key.
 */
export interface ActivityInstance {
  id: string;
  typeId: string;
  config: unknown;
  assignedTo: string;
  classId: string | null;
  sourceLearningPathStepId: string | null;
  resultSummary: unknown | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Parent-granted consent flags the shell may gate an activity on. Voice
 * Recording (`audio_recording`) is the first consumer (EDU-295); photo and
 * video are reserved for future creative types so 1C doesn't have to widen
 * the union later.
 *
 * The persistence + parent-toggle UI ship with EDU-295 — this issue (EDU-302)
 * only adds the registry slot and the shell-side gate.
 *
 * Adding a new key requires three coordinated edits:
 *   1. Extend the union below.
 *   2. Append to `CONSENT_KEYS` (used by the parent server action's Zod
 *      enum and the consent-map sanitizer).
 *   3. Extend the `set_child_consent` SQL allowlist (migration must add
 *      the key to the IN-list — no silent acceptance).
 */
export type ConsentKey =
  | 'audio_recording'
  | 'photo_capture'
  | 'video_capture';

/**
 * Canonical runtime allowlist of `ConsentKey` values. Imported by the
 * parent server action (Zod enum source) and the consent-map sanitizer so
 * those two stay locked together — see the SQL allowlist in
 * `set_child_consent` for the third copy that must agree.
 */
export const CONSENT_KEYS = [
  'audio_recording',
  'photo_capture',
  'video_capture',
] as const satisfies ReadonlyArray<ConsentKey>;

/**
 * The child's resolved consent map, keyed by `ConsentKey`. Missing keys are
 * treated as "not granted" — only `true` counts as consent. Resolved by the
 * page route (server component) and translated through `requiredConsent`
 * into a unified `GateResult` for the player shell.
 */
export type ConsentMap = Partial<Record<ConsentKey, boolean>>;

/**
 * Pattern B return contract for activities server actions.
 * See CLAUDE.md § Server Action Return Contracts.
 */
export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Inputs handed to a registered activity type's renderer. The shell owns the
 * lifecycle (save / undo / redo / submit / exit); the renderer reports a
 * typed result back via `onComplete` so the shell can hand it to the
 * registered `resultCollector`.
 */
export interface ActivityRendererProps<TConfig, TResult> {
  instanceId: string;
  config: TConfig;
  onComplete: (result: TResult) => void;
  onCancel: () => void;
}

/**
 * Input shape for recording a finished activity as a child artifact.
 * The shell forwards this to the portfolio layer; phase 1A doesn't wire the
 * write yet — see EDU-32 plan, phase 1B/1C.
 */
export interface RecordArtifactInput {
  studentId: string;
  classId: string | null;
  artifactType: 'drawing' | 'audio' | 'photo' | 'video' | 'other';
  storagePath: string;
  title?: string | null;
}

/**
 * Reasons a `gate` may deny access to an activity. The shell maps each
 * reason to a kid-mode empty state so per-type access checks (parent
 * consent, grade lock, classroom toggle) live next to the type's other
 * definition fields rather than as one-off `if`s inside `<ActivityPlayer>`.
 */
export type GateDeniedReason =
  | 'consent_required'
  | 'grade_locked'
  | 'class_disabled';

/**
 * Discriminated result of a `gate` hook. `messageKey` is an optional i18n key
 * (relative to the `activities` namespace, e.g.
 * `'player.gate.consent.audioRecordingBody'`) that overrides the generic
 * empty-state body for the reason. Activity types pass a more specific copy
 * key (e.g. why consent is needed for this exact activity) and the shell
 * resolves it via `useTranslation('activities')`. The title always comes from
 * `reason`. When `messageKey` is omitted the shell falls back to the generic
 * empty-state copy for the reason (`player.gate.<reason>.body`).
 */
export type GateResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: GateDeniedReason;
      messageKey?: string;
    };

/**
 * Context handed to a definition's `gate` hook. The gate runs server-side
 * (where we have the SSR Supabase client and the activity instance row), so
 * the page resolves the result and the player only renders it.
 */
export interface StudentActivityContext {
  studentId: string;
  classId: string | null;
  supabase: SupabaseClient<Database>;
  instance: ActivityInstance;
}

/**
 * The contract every registered activity type must satisfy. Generic over the
 * type's config shape and its result shape so the registry stays type-safe
 * end-to-end at the call site.
 */
export interface ActivityTypeDefinition<
  TConfig = unknown,
  TResult = unknown,
> {
  typeId: string;
  displayName: string;
  icon: IconName;
  configSchema: ZodTypeAny;
  RendererComponent: ComponentType<ActivityRendererProps<TConfig, TResult>>;
  resultCollector: (result: TResult) => Promise<RecordArtifactInput>;
  /**
   * Optional access check. When present the shell awaits it before mounting
   * the renderer; on `{ allowed: false }` the shell renders the kid-mode
   * empty state for the matching `reason`. EDU-301.
   */
  gate?: (
    ctx: StudentActivityContext,
  ) => GateResult | Promise<GateResult>;
  /**
   * Optional consent key the child's parent must have granted before the
   * renderer is allowed to load. Declarative shortcut for the common
   * "needs parent consent" case — the page route resolves it into a
   * `GateResult` via the EDU-301 framework, so the shell only sees the
   * unified `gateResult` prop. When a type also declares a `gate` hook,
   * the hook wins and is responsible for the consent decision.
   *
   * Out of scope here: where the consent flag is stored or how the parent
   * toggles it (those ship with EDU-295). The registry only declares which
   * key a type needs.
   */
  requiredConsent?: ConsentKey;
}

/**
 * Helper to derive the inferred config type from a definition. Types
 * implemented in phase 1B/1C will use this so their renderer props are
 * automatically typed off their Zod config schema.
 */
export type ConfigOf<TDef> =
  TDef extends ActivityTypeDefinition<infer TConfig, infer _TResult>
    ? TConfig
    : never;

export type ResultOf<TDef> =
  TDef extends ActivityTypeDefinition<infer _TConfig, infer TResult>
    ? TResult
    : never;

/**
 * Convenience helper to mirror Zod inference style. Usage:
 *   const cfg: ConfigInput<typeof drawingDef> = {...}
 */
export type ConfigInput<TDef> =
  TDef extends ActivityTypeDefinition<infer TConfig, infer _TResult>
    ? TConfig extends ZodTypeAny
      ? z.infer<TConfig>
      : TConfig
    : never;

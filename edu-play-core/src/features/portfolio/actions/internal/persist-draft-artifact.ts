import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import type { ArtifactType } from "../../types";
import { ARTIFACT_SELECT } from "../../queries/types";

const STORAGE_BUCKET = "child-artifacts";

interface DraftArtifact {
  studentId: string;
  classId: string | null;
  bytes: Uint8Array;
  contentType: string;
  extension: string;
  artifactType: ArtifactType;
  title?: string | null;
  metadata?: Record<string, unknown>;
}

type RecordingResult =
  | { success: true; artifactId: string }
  | { success: false; stage: "upload" | "insert" };

/** Call after role-specific authorisation, consent and payload validation. */
export async function persistDraftArtifact(
  supabase: SupabaseClient,
  input: DraftArtifact,
): Promise<RecordingResult> {
  // Storage policies require the student's id in the first path segment.
  const artifactId = crypto.randomUUID();
  const storagePath = `${input.studentId}/${artifactId}.${input.extension}`;
  const upload = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: input.contentType,
      cacheControl: "3600",
      upsert: false,
    });
  if (upload.error) return { success: false, stage: "upload" };

  const { data, error } = await supabase
    .from("child_artifacts")
    .insert({
      id: artifactId,
      student_id: input.studentId,
      class_id: input.classId,
      artifact_type: input.artifactType,
      storage_path: storagePath,
      visibility: "draft",
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    })
    .select(ARTIFACT_SELECT)
    .maybeSingle();

  if (error || !data) {
    // Student Storage policies deny DELETE. Privileged compensation is scoped
    // to this one uploaded key; failure preserves the original insert outcome.
    try {
      await createAdminClient()
        .storage.from(STORAGE_BUCKET)
        .remove([storagePath]);
    } catch {
      // Keep the existing best-effort compensation policy for draft recording.
    }
    return { success: false, stage: "insert" };
  }
  return { success: true, artifactId: data.id };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api";
import type { Database } from "@/shared/types/database";
import { getPreviewSessionOrThrow } from "./cms-api";

type Client = SupabaseClient<Database>;
type LaunchSelection =
  | { mode: "preview"; previewId: string; actorId: string; role: string }
  | { mode: "published"; assignmentId?: string; versionId?: string };

/**
 * Resolves one authorised content snapshot. A privileged client is acquired
 * only after a scoped Activity or Assignment read grants access. Preview
 * ownership remains scoped throughout and never uses the privileged client.
 */
export async function resolveActivityLaunch(
  supabase: Client,
  privilegedClient: () => Client,
  activityId: string,
  selection: LaunchSelection,
) {
  if (selection.mode === "preview") {
    if (selection.role !== "admin" && selection.role !== "teacher") {
      throw ApiError.notFound("Activity config");
    }
    const session = await getPreviewSessionOrThrow(supabase, {
      previewId: selection.previewId,
      activityId,
      actorId: selection.actorId,
    });
    const { data: activity, error } = await supabase
      .from("activities")
      .select("*")
      .eq("id", activityId)
      .single();
    if (error || !activity) throw ApiError.notFound("Activity config");
    return {
      activity,
      typeId: session.typeId,
      config: session.configData,
      versionId: null,
    };
  }

  let assignedVersionId: string | null = null;
  let assignmentTeacherId: string | null = null;
  if (selection.assignmentId) {
    const { data: assignment, error } = await supabase
      .from("assignments")
      .select("id, activity_id, version_id, teacher_id")
      .eq("id", selection.assignmentId)
      .single();
    if (
      error ||
      !assignment?.version_id ||
      assignment.activity_id !== activityId ||
      (selection.versionId && assignment.version_id !== selection.versionId)
    ) {
      throw ApiError.notFound("Activity config");
    }
    assignedVersionId = assignment.version_id;
    assignmentTeacherId = assignment.teacher_id;
  } else {
    const { data, error } = await supabase
      .from("activities")
      .select("id")
      .eq("id", activityId)
      .eq("is_published", true)
      .single();
    if (error || !data) throw ApiError.notFound("Activity config");
  }

  const admin = privilegedClient();
  const { data: activity, error } = await admin
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .eq("is_published", true)
    .single();
  if (
    error ||
    !activity ||
    (selection.assignmentId &&
      activity.visibility_scope === "private" &&
      assignmentTeacherId !== activity.created_by)
  ) {
    throw ApiError.notFound("Activity config");
  }

  let versionQuery = admin
    .from("activity_versions")
    .select("id, activity_id, activity_type_id, config_data")
    .eq("activity_id", activityId);
  versionQuery = assignedVersionId
    ? versionQuery.eq("id", assignedVersionId)
    : versionQuery.order("version_number", { ascending: false }).limit(1);
  const { data: version, error: versionError } = await versionQuery.single();
  if (
    versionError ||
    !version ||
    version.activity_id !== activityId ||
    (selection.versionId && version.id !== selection.versionId)
  ) {
    throw ApiError.notFound("Activity config");
  }
  return {
    activity,
    typeId: version.activity_type_id,
    config: version.config_data ?? {},
    versionId: version.id,
  };
}

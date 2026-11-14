import { createAdminClient, createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ROUTES } from "@/shared/lib/constants";
import { FreeResponsePlayContent } from "@/features/activities";
import { GamePageContent } from "@/features/games";
import { getPreviewSessionOrThrow } from "@/features/activities/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const ACTIVITY_HOST_CACHE_BUSTER = "asset-library-v2";

interface ActivityResourceRow {
  resource_type?: string | null;
  title?: string | null;
  url?: string | null;
}

async function getLinkResources(
  supabase: SupabaseClient,
  activityId: string,
  versionId: string | null,
) {
  let query = supabase
    .from("activity_resources")
    .select("resource_type, title, url, sort_order")
    .eq("activity_id", activityId)
    .order("sort_order", { ascending: true });

  query = versionId
    ? query.eq("version_id", versionId)
    : query.is("version_id", null);

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];

  return (data as ActivityResourceRow[])
    .filter(
      (resource) =>
        resource.resource_type === "link" && resource.title && resource.url,
    )
    .map((resource) => ({ title: resource.title!, url: resource.url! }));
}

function addResourcesToConfig(
  config: unknown,
  resources: Array<{ title: string; url: string }>,
) {
  const base =
    config && typeof config === "object" && !Array.isArray(config)
      ? config
      : {};
  return { ...base, resources };
}

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const { activityId } = await params;
  const query = await searchParams;
  const previewId = query.previewId;
  const assignmentId = query.assignmentId;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect(ROUTES.AUTH.LOGIN);
  }

  const previewSession = previewId
    ? await (async () => {
        if (profile.role !== "admin" && profile.role !== "teacher") {
          notFound();
        }
        try {
          return await getPreviewSessionOrThrow(supabase, {
            previewId,
            activityId,
            actorId: user.id,
          });
        } catch {
          notFound();
        }
      })()
    : null;

  const pinnedAssignment =
    !previewSession && assignmentId
      ? (
          await supabase
            .from("assignments")
            .select("id, activity_id, version_id, teacher_id")
            .eq("id", assignmentId)
            .single()
        ).data
      : null;

  if (
    !previewSession &&
    assignmentId &&
    (!pinnedAssignment?.version_id ||
      pinnedAssignment.activity_id !== activityId)
  ) {
    notFound();
  }

  const activityClient = pinnedAssignment ? createAdminClient() : supabase;
  const activityQuery = activityClient
    .from("activities")
    .select("*")
    .eq("id", activityId);

  if (!previewSession) {
    activityQuery.eq("is_published", true);
  }

  const { data: activity } = await activityQuery.single();

  if (!activity) {
    notFound();
  }

  if (
    pinnedAssignment &&
    activity.visibility_scope === "private" &&
    pinnedAssignment.teacher_id !== activity.created_by
  ) {
    notFound();
  }

  // Build renderer URL with non-identity query param overrides. Activity
  // content is loaded by the renderer through the exact same-origin configUrl.
  const urlParams = new URLSearchParams();
  urlParams.set("lang", query.lang || activity.default_lang || "ro");
  if (query.theme || activity.default_theme) {
    urlParams.set("theme", (query.theme || activity.default_theme)!);
  }
  if (query.muted) {
    urlParams.set("muted", query.muted);
  }

  const publishedVersion = previewSession
    ? null
    : pinnedAssignment?.version_id
      ? (
          await createAdminClient()
            .from("activity_versions")
            .select("id, activity_id, activity_type_id, config_data")
            .eq("activity_id", activityId)
            .eq("id", pinnedAssignment.version_id)
            .single()
        ).data
      : (
          await supabase
            .from("activity_versions")
            .select("id, activity_id, activity_type_id, config_data")
            .eq("activity_id", activityId)
            .order("version_number", { ascending: false })
            .limit(1)
            .single()
        ).data;

  if (!previewSession && !publishedVersion) {
    notFound();
  }

  if (
    pinnedAssignment &&
    publishedVersion &&
    publishedVersion.activity_id !== activityId
  ) {
    notFound();
  }

  const activityTypeId =
    previewSession?.typeId ?? publishedVersion!.activity_type_id;
  const resources = await getLinkResources(
    supabase,
    activityId,
    previewSession ? null : publishedVersion!.id,
  );
  const { data: activityType } = await supabase
    .from("activity_types")
    .select("renderer_key, renderer_kind")
    .eq("type_id", activityTypeId)
    .single();

  if (!activityType) {
    notFound();
  }

  const rendererKey = activityType.renderer_key;
  const configParams = new URLSearchParams();
  const configUrl = previewSession
    ? (() => {
        configParams.set("previewId", previewId!);
        return `/api/v1/activities/${activityId}/preview/config?${configParams.toString()}`;
      })()
    : (() => {
        configParams.set("versionId", publishedVersion!.id);
        if (assignmentId) configParams.set("assignmentId", assignmentId);
        return `/api/v1/activities/${activityId}/config?${configParams.toString()}`;
      })();

  const backUrl =
    profile.role === "admin"
      ? ROUTES.ADMIN.CMS_ACTIVITY(activityId)
      : profile.role === "teacher"
        ? ROUTES.TEACHER.ACTIVITIES
        : profile.role === "parent"
          ? ROUTES.PARENT.ACTIVITIES
          : ROUTES.STUDENT.DASHBOARD;

  const initialSubmission =
    !previewSession && assignmentId && profile.role === "student"
      ? (
          await supabase
            .from("activity_submissions")
            .select("status, latest_response")
            .eq("assignment_id", assignmentId)
            .eq("student_id", user.id)
            .limit(1)
            .single()
        ).data
      : null;

  if (activityType.renderer_kind === "react") {
    if (rendererKey !== "free-response") {
      notFound();
    }

    return (
      <FreeResponsePlayContent
        title={activity.title}
        backUrl={backUrl}
        mode={previewSession ? "preview" : "play"}
        config={addResourcesToConfig(
          previewSession?.configData ?? publishedVersion?.config_data ?? {},
          resources,
        )}
        activityId={previewSession ? undefined : activityId}
        versionId={previewSession ? undefined : publishedVersion!.id}
        assignmentId={previewSession ? undefined : assignmentId}
        initialSubmission={
          initialSubmission
            ? {
                status: initialSubmission.status,
                latestResponse: initialSubmission.latest_response,
              }
            : null
        }
      />
    );
  }

  const playerName =
    typeof profile.full_name === "string" && profile.full_name.trim()
      ? profile.full_name.trim().split(/\s+/)[0]
      : null;

  const isActivityHostRenderer = rendererKey === "activity-host";
  if (isActivityHostRenderer) {
    urlParams.set("hostCache", ACTIVITY_HOST_CACHE_BUSTER);
  }

  const rendererPath = isActivityHostRenderer
    ? `${rendererKey}/templates/${encodeURIComponent(activityTypeId)}`
    : `${rendererKey}/index.html`;
  const gameUrl = `/api/v1/renderer-proxy/activity-renderers/${rendererPath}?${urlParams.toString()}`;

  return (
    <GamePageContent
      game={{
        id: activity.id,
        title: activity.title,
        game_url: gameUrl,
        category: activity.category,
        difficulty_level:
          activity.difficulty === "easy"
            ? 1
            : activity.difficulty === "medium"
              ? 3
              : 5,
        estimated_duration: activity.estimated_duration,
      }}
      progress={null}
      backUrl={backUrl}
      activityId={previewSession ? undefined : activityId}
      versionId={previewSession ? undefined : publishedVersion!.id}
      assignmentId={previewSession ? undefined : assignmentId}
      configUrl={configUrl}
      studentId={profile.role === "student" ? user.id : undefined}
      playerName={playerName}
    />
  );
}

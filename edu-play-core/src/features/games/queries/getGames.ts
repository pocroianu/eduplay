import { createClient } from "@/lib/supabase/server";
import { getAssignmentActivityPlayHref } from "@/features/activities";
import { filterStudentVisibleGames } from "@/lib/feature-flags";
import type {
  Game,
  GameProgress,
  GameWithProgress,
  GameCategory,
} from "../types";

type ActivityCatalogRow = {
  id: string;
  title: string;
  template: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string | null;
  difficulty: string | null;
  target_age_min: number | null;
  target_age_max: number | null;
  estimated_duration: number | null;
  skills?: string[] | null;
  tags?: string[] | null;
  is_published: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

const ACTIVITY_SELECT =
  "id, title, template, description, thumbnail_url, category, difficulty, target_age_min, target_age_max, estimated_duration, skills, tags, is_published, created_at, updated_at";

function difficultyToLevel(difficulty: string | null): number | null {
  if (difficulty === "easy") return 1;
  if (difficulty === "medium") return 3;
  if (difficulty === "hard") return 5;
  return null;
}

function toCatalogGame(row: ActivityCatalogRow): Game {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    template: row.template,
    thumbnail_url: row.thumbnail_url,
    game_url: `/play/${row.id}`,
    category: row.category as GameCategory | null,
    difficulty_level: difficultyToLevel(row.difficulty),
    target_age_min: row.target_age_min,
    target_age_max: row.target_age_max,
    estimated_duration: row.estimated_duration,
    learning_objectives: row.skills ?? row.tags ?? null,
    is_published: row.is_published ?? false,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  };
}

/**
 * Fetch all published Activities, exposed through the historical Game-shaped
 * catalog type until the presentation layer is renamed.
 */
export async function getPublishedGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_SELECT)
    .eq("is_published", true)
    .eq("status", "published")
    .eq("visibility_scope", "public")
    .order("category")
    .order("difficulty");

  if (error) {
    console.error("Error fetching activities:", error);
    throw error;
  }
  return ((data ?? []) as ActivityCatalogRow[]).map(toCatalogGame);
}

/**
 * Fetch published Activities filtered by student-facing feature-flag gates.
 */
export async function getStudentVisibleGames(): Promise<Game[]> {
  const games = await getPublishedGames();
  return filterStudentVisibleGames(games);
}

export async function getGamesByCategory(
  category: GameCategory,
): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_SELECT)
    .eq("is_published", true)
    .eq("category", category)
    .order("difficulty");

  if (error) {
    console.error("Error fetching activities by category:", error);
    throw error;
  }
  return ((data ?? []) as ActivityCatalogRow[]).map(toCatalogGame);
}

export async function getGameById(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching activity:", error);
    return null;
  }
  return data ? toCatalogGame(data as ActivityCatalogRow) : null;
}

export async function getStudentProgress(
  studentId: string,
): Promise<GameProgress[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_progress")
    .select("*")
    .eq("student_id", studentId);

  if (error) {
    console.error("Error fetching student activity progress:", error);
    throw error;
  }
  return toProgressRows(data ?? []);
}

export async function getStudentGameProgress(
  studentId: string,
  gameId: string,
): Promise<GameProgress | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_progress")
    .select("*")
    .eq("student_id", studentId)
    .eq("activity_id", gameId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching activity progress:", error);
  }
  return data ? toProgressRows([data])[0] : null;
}

export async function getGamesWithProgress(
  studentId: string,
): Promise<GameWithProgress[]> {
  const [games, progressList] = await Promise.all([
    getStudentVisibleGames(),
    getStudentProgress(studentId),
  ]);

  const progressMap = new Map(progressList.map((p) => [p.game_id, p]));

  return games.map((game) => ({
    ...game,
    progress: progressMap.get(game.id) || null,
  }));
}

export async function getInProgressGames(
  studentId: string,
): Promise<GameWithProgress[]> {
  const gamesWithProgress = await getGamesWithProgress(studentId);
  return gamesWithProgress.filter((g) => g.progress?.status === "in_progress");
}

export async function getAssignedGames(studentId: string): Promise<Game[]> {
  const supabase = await createClient();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .single();

  if (studentError) {
    console.error("Error fetching student class:", studentError);
    throw studentError;
  }

  if (!student.class_id) {
    return [];
  }

  const { data: assignments, error } = await supabase
    .from("assignments")
    .select(
      `
      id,
      activity_id,
      version_id,
      activities:activity_id (${ACTIVITY_SELECT})
    `,
    )
    .or(`student_id.eq.${studentId},class_id.eq.${student.class_id}`);

  if (error) {
    console.error("Error fetching assignments:", error);
    return [];
  }

  const gameMap = new Map<string, Game>();
  for (const assignment of assignments ?? []) {
    const rawActivity = (assignment as unknown as { activities?: ActivityCatalogRow | ActivityCatalogRow[] | null }).activities;
    const activity = Array.isArray(rawActivity) ? rawActivity[0] : rawActivity;
    const activityId = (assignment as { activity_id?: string | null }).activity_id;
    if (!activity || !activityId || gameMap.has(activityId)) continue;

    gameMap.set(activityId, {
      ...toCatalogGame(activity),
      launchHref: getAssignmentActivityPlayHref(assignment) ?? undefined,
    });
  }

  return filterStudentVisibleGames(Array.from(gameMap.values()));
}

export async function getAllGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(ACTIVITY_SELECT)
    .order("is_published", { ascending: false })
    .order("category")
    .order("difficulty");

  if (error) {
    console.error("Error fetching all activities:", error);
    throw error;
  }
  return ((data ?? []) as ActivityCatalogRow[]).map(toCatalogGame);
}

export async function getChildrenGamesProgress(parentId: string): Promise<
  Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
    gamesWithProgress: GameWithProgress[];
  }>
> {
  const supabase = await createClient();

  const { data: children, error: childrenError } = await supabase
    .from("students")
    .select("id, username, avatar_url")
    .eq("parent_id", parentId);

  if (childrenError) {
    console.error("Error fetching children:", childrenError);
    return [];
  }

  if (!children || children.length === 0) {
    return [];
  }

  const games = await getStudentVisibleGames();
  const result = await Promise.all(
    children.map(async (child) => {
      const { data: progressData, error: progressError } = await supabase
        .from("activity_progress")
        .select("*")
        .eq("student_id", child.id);

      if (progressError) {
        console.error(`Error fetching progress for child ${child.id}:`, progressError);
      }

      const progressList = progressError ? [] : toProgressRows(progressData ?? []);
      const progressMap = new Map(progressList.map((p) => [p.game_id, p]));

      return {
        id: child.id,
        name: child.username,
        avatarUrl: child.avatar_url,
        gamesWithProgress: games.map((game) => ({
          ...game,
          progress: progressMap.get(game.id) || null,
        })),
      };
    }),
  );

  return result;
}

function toProgressRows(
  rows: Array<{
    id: string;
    student_id: string;
    activity_id: string;
    status: string | null;
    score: number | null;
    time_spent: number | null;
    attempts: number | null;
    last_played_at: string | null;
    completed_at: string | null;
    data: unknown;
    created_at: string | null;
    updated_at: string | null;
  }>,
): GameProgress[] {
  return rows.map((row) => ({
    id: row.id,
    student_id: row.student_id,
    game_id: row.activity_id,
    status: (row.status ?? "in_progress") as GameProgress["status"],
    score: row.score,
    time_spent: row.time_spent,
    attempts: row.attempts ?? 0,
    last_played_at: row.last_played_at,
    completed_at: row.completed_at,
    data: row.data as Record<string, unknown> | null,
    created_at: row.created_at ?? "",
    updated_at: row.updated_at ?? "",
  }));
}

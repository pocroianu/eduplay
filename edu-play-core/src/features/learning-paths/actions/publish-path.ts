"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/shared/lib/constants";
import { pathIdSchema } from "../schemas";
import type { ActionResult, LearningPath } from "../types";
import {
  LEARNING_PATH_SELECT,
  mapLearningPathRow,
  type LearningPathRowSnake,
} from "../queries/types";
import { requireTeacher } from "./internal/require-teacher";

/**
 * Flips a path from `draft` to `published`. Re-publishing an already
 * published or archived path is intentionally rejected by the draft
 * predicate below; archived paths need the separate lifecycle flow.
 *
 * Archive transitions land in EDU-31.B+ — they need a separate action
 * because the lifecycle UX is different (confirmation modal, undo grace).
 */
export async function publishPath(
  input: unknown,
): Promise<ActionResult<{ path: LearningPath }>> {
  const parsed = pathIdSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Date invalide",
    };
  }

  const auth = await requireTeacher();
  if (!auth.ok) return auth.error;

  const { ctx } = auth;

  const { data: stepRows, error: stepError } = await ctx.supabase
    .from("learning_path_steps")
    .select("id")
    .eq("path_id", parsed.data.pathId)
    .limit(1);

  if (stepError) {
    return {
      success: false,
      error: "Nu am putut publica parcursul. Încearcă din nou.",
    };
  }

  if (!stepRows || stepRows.length === 0) {
    return {
      success: false,
      error: "Adaugă cel puțin un pas înainte să publici parcursul",
    };
  }

  const { data, error } = await ctx.supabase
    .from("learning_paths")
    .update({ status: "published" })
    .eq("id", parsed.data.pathId)
    .eq("status", "draft")
    .select(LEARNING_PATH_SELECT)
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: "Nu am putut publica parcursul. Încearcă din nou.",
    };
  }

  if (!data) {
    return {
      success: false,
      error: "Parcursul nu a fost găsit sau nu mai este în lucru",
    };
  }

  revalidatePath(ROUTES.TEACHER.DASHBOARD);

  return {
    success: true,
    data: { path: mapLearningPathRow(data as LearningPathRowSnake) },
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/shared/lib/constants";
import { pathIdSchema } from "../schemas";
import type { ActionResult, LearningPath } from "../types";
import {
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

  const { data, error } = await ctx.supabase
    .rpc('publish_learning_path', { p_path_id: parsed.data.pathId })
    .single();

  if (error || !data) {
    const messages: Record<string, string> = {
      learning_path_empty: 'Adaugă cel puțin un pas înainte să publici parcursul',
      learning_path_not_found: 'Parcursul nu a fost găsit sau nu mai este în lucru',
      learning_path_not_draft: 'Parcursul nu a fost găsit sau nu mai este în lucru',
    };
    return {
      success: false,
      error: messages[error?.message ?? ''] ?? 'Nu am putut publica parcursul. Încearcă din nou.',
    };
  }

  revalidatePath(ROUTES.TEACHER.DASHBOARD);

  return {
    success: true,
    data: { path: mapLearningPathRow(data as LearningPathRowSnake) },
  };
}

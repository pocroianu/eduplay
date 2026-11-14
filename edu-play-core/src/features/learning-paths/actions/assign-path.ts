"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/shared/lib/constants";
import { assignPathInputSchema } from "../schemas";
import type { ActionResult, LearningPathAssignment } from "../types";
import {
  LEARNING_PATH_ASSIGNMENT_SELECT,
  mapLearningPathAssignmentRow,
  type LearningPathAssignmentRowSnake,
} from "../queries/types";
import { requireTeacher } from "./internal/require-teacher";

interface SupabaseWriteError {
  code?: string;
  message?: string;
}

function isDuplicateAssignmentError(
  error: SupabaseWriteError | null | undefined,
) {
  return error?.code === "23505";
}

/**
 * Assigns a published, assignable path to either a class or a single
 * student. The class XOR student rule is enforced by both the Zod schema
 * and the DB CHECK; the WITH CHECK on the RLS policy additionally pins
 * `assigned_by = auth.uid()` so we can't spoof the field.
 *
 * The publish + assignable-scope gates are enforced here, not at the DB
 * level — the migration's INSERT WITH CHECK only pins roster scope, so a
 * teacher could otherwise assign drafts or another teacher's published
 * path if RLS lets them read it.
 */
export async function assignPath(
  input: unknown,
): Promise<ActionResult<{ assignment: LearningPathAssignment }>> {
  const parsed = assignPathInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Date invalide",
    };
  }

  const auth = await requireTeacher();
  if (!auth.ok) return auth.error;

  const { ctx } = auth;

  const { data: pathRow, error: pathError } = await ctx.supabase
    .from("learning_paths")
    .select("status, owner_kind, created_by")
    .eq("id", parsed.data.pathId)
    .maybeSingle();

  if (pathError) {
    return {
      success: false,
      error: "Nu am putut atribui parcursul. Încearcă din nou.",
    };
  }

  if (!pathRow) {
    return { success: false, error: "Parcursul nu a fost găsit" };
  }

  if (pathRow.status !== "published") {
    return {
      success: false,
      error: "Parcursul nu este publicat încă",
    };
  }

  const canAssignPath =
    ctx.profile.role === "admin" ||
    pathRow.created_by === ctx.user.id ||
    pathRow.owner_kind === "admin";

  if (!canAssignPath) {
    return {
      success: false,
      error: "Nu poți atribui acest parcurs",
    };
  }

  const { data, error } = await ctx.supabase
    .from("learning_path_assignments")
    .insert({
      path_id: parsed.data.pathId,
      class_id: parsed.data.classId ?? null,
      student_id: parsed.data.studentId ?? null,
      assigned_by: ctx.user.id,
      due_date: parsed.data.dueDate ?? null,
    })
    .select(LEARNING_PATH_ASSIGNMENT_SELECT)
    .maybeSingle();

  if (error || !data) {
    if (isDuplicateAssignmentError(error)) {
      return {
        success: false,
        error: "Acest parcurs este deja atribuit.",
      };
    }

    return {
      success: false,
      error: "Nu am putut atribui parcursul. Încearcă din nou.",
    };
  }

  revalidatePath(ROUTES.TEACHER.DASHBOARD);
  revalidatePath(ROUTES.TEACHER.PATH(parsed.data.pathId));
  revalidatePath(ROUTES.TEACHER.PATHS);
  if (parsed.data.classId) {
    revalidatePath(ROUTES.TEACHER.CLASS(parsed.data.classId));
  }
  if (parsed.data.studentId) {
    revalidatePath(ROUTES.TEACHER.STUDENT(parsed.data.studentId));
  }

  return {
    success: true,
    data: {
      assignment: mapLearningPathAssignmentRow(
        data as LearningPathAssignmentRowSnake,
      ),
    },
  };
}

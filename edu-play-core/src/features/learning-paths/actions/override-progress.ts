"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { ROUTES } from "@/shared/lib/constants";
import { overrideProgressInputSchema } from "../schemas";
import type { ActionResult, StudentPathProgress } from "../types";
import {
  STUDENT_PATH_PROGRESS_SELECT,
  mapStudentPathProgressRow,
  type StudentPathProgressRowSnake,
} from "../queries/types";
import { requireTeacher } from "./internal/require-teacher";

/**
 * Teacher override for a student's path progress. The class-progress
 * matrix view (EDU-31.G + UI in EDU-31.H) calls this when a teacher wants
 * to manually flip a row to `completed` after an in-person assessment, or
 * to `overridden` to mark the path as no longer applicable to the student.
 *
 * Implementation note: an UPDATE is the wrong primitive here because no
 * progress row may exist yet (student has been assigned but never opened
 * the path). UPSERT keyed on the
 * `(student_id, path_id)` UNIQUE constraint installed in the migration.
 */
export async function overrideProgress(
  input: unknown,
): Promise<ActionResult<{ progress: StudentPathProgress }>> {
  const parsed = overrideProgressInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Date invalide",
    };
  }

  const auth = await requireTeacher();
  if (!auth.ok) return auth.error;

  const { ctx } = auth;
  const now = new Date().toISOString();
  const completed = parsed.data.status === "completed";
  const studentLookupClient =
    ctx.profile.role === "admin" ? createAdminClient() : ctx.supabase;

  const { data: studentRow, error: studentError } = await studentLookupClient
    .from("students")
    .select("class_id")
    .eq("id", parsed.data.studentId)
    .maybeSingle();

  if (studentError) {
    return {
      success: false,
      error: "Nu am putut actualiza progresul. Încearcă din nou.",
    };
  }

  if (!studentRow) {
    return { success: false, error: "Elevul nu a fost găsit" };
  }

  const assignmentScopeFilter = studentRow.class_id
    ? `student_id.eq.${parsed.data.studentId},class_id.eq.${studentRow.class_id}`
    : `student_id.eq.${parsed.data.studentId}`;

  const { data: assignmentRows, error: assignmentError } = await ctx.supabase
    .from("learning_path_assignments")
    .select("id")
    .eq("path_id", parsed.data.pathId)
    .or(assignmentScopeFilter)
    .limit(1);

  if (assignmentError) {
    return {
      success: false,
      error: "Nu am putut actualiza progresul. Încearcă din nou.",
    };
  }

  if (!assignmentRows || assignmentRows.length === 0) {
    return {
      success: false,
      error: "Nu poți actualiza un parcurs neatribuit",
    };
  }

  const { data, error } = await ctx.supabase
    .from("student_path_progress")
    .upsert(
      {
        student_id: parsed.data.studentId,
        path_id: parsed.data.pathId,
        status: parsed.data.status,
        current_step_id: parsed.data.currentStepId ?? null,
        ...(completed ? {} : { last_completed_step_id: null }),
        // Always send the column so reopening a completed row clears the
        // stale timestamp instead of leaving "completed at X" attached to
        // an in_progress / overridden row (CTO review of PR #144).
        completed_at: completed ? now : null,
      },
      { onConflict: "student_id,path_id" },
    )
    .select(STUDENT_PATH_PROGRESS_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: "Nu am putut actualiza progresul. Încearcă din nou.",
    };
  }

  revalidatePath(ROUTES.TEACHER.DASHBOARD);
  revalidatePath(ROUTES.TEACHER.STUDENT(parsed.data.studentId));

  return {
    success: true,
    data: {
      progress: mapStudentPathProgressRow(data as StudentPathProgressRowSnake),
    },
  };
}

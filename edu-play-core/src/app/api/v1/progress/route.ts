import {
  handleRoute,
  requireAuth,
  parseBody,
  parseQuery,
  parsePagination,
  toRange,
  buildMeta,
  success,
  paginated,
  camelCaseKeys,
  parseRow,
  parseRows,
  assertTeacherOwnsStudent,
  getScopedStudentIds,
  ApiError,
} from '@/lib/api';
import {
  recordProgressSchema,
  listProgressQuerySchema,
  progressRowSchema,
  type RecordProgressInput,
} from '@/features/api/schemas/progress.schema';

type SupabaseForProgress = Awaited<ReturnType<typeof requireAuth>>['supabase'];

interface AssignmentProgressContext {
  activityId: string;
  versionId: string;
}

async function resolveAssignmentProgressContext(
  supabase: SupabaseForProgress,
  assignmentId: string | undefined,
  expected: { activityId: string; versionId?: string },
): Promise<AssignmentProgressContext | null> {
  if (!assignmentId) return null;

  const { data, error } = await supabase
    .from('assignments')
    .select('id, activity_id, version_id')
    .eq('id', assignmentId)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Assignment');
  }

  const assignment = data as {
    activity_id: string | null;
    version_id: string | null;
  };

  if (assignment.activity_id !== expected.activityId) {
    throw ApiError.validation('Assignment does not target this activity');
  }

  if (!assignment.version_id) {
    throw ApiError.validation('Assignment is missing a pinned activity version');
  }

  if (expected.versionId && assignment.version_id !== expected.versionId) {
    throw ApiError.validation('Assignment does not target this activity version');
  }

  return {
    activityId: assignment.activity_id,
    versionId: assignment.version_id,
  };
}

function buildProgressPatch(
  existing: { attempts?: number | null; time_spent?: number | null } | null,
  body: RecordProgressInput,
  now: string,
) {
  const payload: Record<string, unknown> = {
    attempts: (existing?.attempts ?? 0) + 1,
    last_played_at: now,
    updated_at: now,
  };

  if (body.status !== undefined) payload.status = body.status;
  if (body.score !== undefined) payload.score = body.score;
  if (body.timeSpent !== undefined) {
    payload.time_spent = (existing?.time_spent ?? 0) + body.timeSpent;
  }
  if (body.data !== undefined) payload.data = body.data;
  if (body.status === 'completed') payload.completed_at = now;

  return payload;
}

async function upsertActivityProgress(
  supabase: SupabaseForProgress,
  input: {
    studentId: string;
    activityId: string;
    lastVersionId?: string | null;
    body: RecordProgressInput;
    now: string;
  },
) {
  const { data: existing, error: fetchErr } = await supabase
    .from('activity_progress')
    .select('*')
    .eq('student_id', input.studentId)
    .eq('activity_id', input.activityId)
    .maybeSingle();

  if (fetchErr) throw new ApiError('INTERNAL_ERROR', fetchErr.message);

  if (existing) {
    const updatePayload = buildProgressPatch(existing, input.body, input.now);
    if (input.lastVersionId !== undefined) updatePayload.last_version_id = input.lastVersionId;

    const { data, error } = await supabase
      .from('activity_progress')
      .update(updatePayload)
      .eq('id', (existing as { id: string }).id)
      .select('*, activities:activity_id (title, category, difficulty)')
      .single();

    if (error) throw new ApiError('INTERNAL_ERROR', error.message);
    return data;
  }

  const insertPayload: Record<string, unknown> = {
    student_id: input.studentId,
    activity_id: input.activityId,
    last_version_id: input.lastVersionId ?? null,
    status: input.body.status ?? 'in_progress',
    attempts: 1,
    last_played_at: input.now,
  };

  if (input.body.score !== undefined) insertPayload.score = input.body.score;
  if (input.body.timeSpent !== undefined) insertPayload.time_spent = input.body.timeSpent;
  if (input.body.data !== undefined) insertPayload.data = input.body.data;
  if (input.body.status === 'completed') insertPayload.completed_at = input.now;

  const { data, error } = await supabase
    .from('activity_progress')
    .insert(insertPayload)
    .select('*, activities:activity_id (title, category, difficulty)')
    .single();

  if (error) throw new ApiError('INTERNAL_ERROR', error.message);
  return data;
}

/* ------------------------------------------------------------------ */
/*  GET /api/v1/progress — list progress (role-scoped)                */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async (req) => {
  const ctx = await requireAuth();
  const { searchParams } = new URL(req.url);
  const query = parseQuery(searchParams, listProgressQuerySchema);
  const pagination = parsePagination(searchParams);
  const { from, to } = toRange(pagination);

  const scope = await getScopedStudentIds(
    ctx.supabase,
    { id: ctx.user.id, role: ctx.profile.role },
    { requestedStudentId: query.studentId },
  );

  if (scope.unsupportedRole || scope.studentIds.length === 0) {
    return paginated([], buildMeta(pagination, 0));
  }

  let dbQuery = ctx.supabase
    .from('activity_progress')
    .select('*, activities:activity_id (title, category, difficulty)', { count: 'exact' })
    .in('student_id', scope.studentIds)
    .order('last_played_at', { ascending: false })
    .range(from, to);

  if (query.activityId) {
    dbQuery = dbQuery.eq('activity_id', query.activityId);
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }

  const { data, error, count } = await dbQuery;

  if (error) throw new ApiError('INTERNAL_ERROR', error.message);

  const meta = buildMeta(pagination, count ?? 0);
  const rows = parseRows(
    (data ?? []).map(camelCaseKeys),
    progressRowSchema,
    'GET /api/v1/progress',
  );
  return paginated(rows, meta);
});

/* ------------------------------------------------------------------ */
/*  POST /api/v1/progress — record / upsert progress                 */
/* ------------------------------------------------------------------ */

export const POST = handleRoute(async (req) => {
  const ctx = await requireAuth();
  const body = await parseBody(req, recordProgressSchema);

  const role = ctx.profile.role;
  let studentId: string;

  if (role === 'student') {
    studentId = ctx.user.id;
  } else if (role === 'teacher') {
    const requestedStudentId = body.studentId;

    if (!requestedStudentId) {
      throw ApiError.validation('Teachers must specify a studentId');
    }

    await assertTeacherOwnsStudent(ctx.supabase, ctx.user.id, requestedStudentId);
    studentId = requestedStudentId;
  } else {
    throw ApiError.forbidden('Only students and teachers can record progress');
  }

  const now = new Date().toISOString();
  const explicitVersionId = body.versionId ?? body.lastVersionId;
  const assignmentContext = await resolveAssignmentProgressContext(
    ctx.supabase,
    body.assignmentId,
    { activityId: body.activityId, versionId: explicitVersionId },
  );

  const result = await upsertActivityProgress(ctx.supabase, {
    studentId,
    activityId: body.activityId,
    lastVersionId: explicitVersionId ?? assignmentContext?.versionId ?? null,
    body,
    now,
  });

  const row = parseRow(
    camelCaseKeys(result),
    progressRowSchema,
    'POST /api/v1/progress',
  );
  return success(row);
});

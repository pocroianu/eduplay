import {
  handleRoute,
  requireRole,
  parseBody,
  parseRow,
  success,
  noContent,
  camelCaseKeys,
  snakeCaseKeys,
  ApiError,
} from '@/lib/api';
import {
  classRowSchema,
  updateClassSchema,
} from '@/features/api/schemas/class.schema';

/* ------------------------------------------------------------------ */
/*  GET /api/v1/classes/:id — get a single class                      */
/* ------------------------------------------------------------------ */

export const GET = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');

  const { data, error } = await ctx.supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .eq('teacher_id', ctx.user.id)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Class not found');
  }

  const row = parseRow(camelCaseKeys(data), classRowSchema, 'GET /api/v1/classes/[id]');
  return success(row);
});

/* ------------------------------------------------------------------ */
/*  PATCH /api/v1/classes/:id — update a class                        */
/* ------------------------------------------------------------------ */

export const PATCH = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');
  const body = await parseBody(req, updateClassSchema);

  const { data, error } = await ctx.supabase
    .from('classes')
    .update(snakeCaseKeys(body))
    .eq('id', id)
    .eq('teacher_id', ctx.user.id)
    .select()
    .single();

  if (error || !data) {
    throw ApiError.notFound('Class not found');
  }

  const row = parseRow(camelCaseKeys(data), classRowSchema, 'PATCH /api/v1/classes/[id]');
  return success(row);
});

/* ------------------------------------------------------------------ */
/*  DELETE /api/v1/classes/:id — delete a class                       */
/* ------------------------------------------------------------------ */

export const DELETE = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');

  const { error } = await ctx.supabase
    .from('classes')
    .delete()
    .eq('id', id)
    .eq('teacher_id', ctx.user.id);

  if (error) {
    throw new ApiError('INTERNAL_ERROR', error.message);
  }

  return noContent();
});

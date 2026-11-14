import {
  ApiError,
  camelCaseKeys,
  handleRoute,
  noContent,
  parseBody,
  requireRole,
  success,
} from '@/lib/api';
import { updateListenTapWordListSchema } from '@/features/api/schemas/listen-tap-word-list.schema';

export const GET = handleRoute(async (_req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');

  const { data, error } = await ctx.supabase
    .from('listen_tap_word_lists')
    .select('*')
    .eq('id', id)
    .eq('owner_teacher_id', ctx.user.id)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Word list');
  }

  return success(camelCaseKeys(data));
});

export const PATCH = handleRoute(async (req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');
  const body = await parseBody(req, updateListenTapWordListSchema);

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.language !== undefined) updates.language = body.language;
  if (body.words !== undefined) updates.words = body.words;

  if (Object.keys(updates).length === 0) {
    throw ApiError.validation('At least one field must be provided');
  }

  const { data, error } = await ctx.supabase
    .from('listen_tap_word_lists')
    .update(updates)
    .eq('id', id)
    .eq('owner_teacher_id', ctx.user.id)
    .select()
    .single();

  if (error || !data) {
    throw ApiError.notFound('Word list');
  }

  return success(camelCaseKeys(data));
});

export const DELETE = handleRoute(async (_req, context) => {
  const { id } = await context!.params;
  const ctx = await requireRole('teacher');

  const { data, error } = await ctx.supabase
    .from('listen_tap_word_lists')
    .delete()
    .eq('id', id)
    .eq('owner_teacher_id', ctx.user.id)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    throw ApiError.notFound('Word list');
  }

  return noContent();
});

import { createClient } from '@/lib/supabase/server';
import {
  camelCaseKeys,
  handleRoute,
  parseRow,
  success,
  ApiError,
} from '@/lib/api';
import { activityTypeRowSchema } from '@/features/api';

export const GET = handleRoute(async (_req, context) => {
  const supabase = await createClient();
  const { typeId } = await context!.params;

  const { data, error } = await supabase
    .from('activity_types')
    .select('*')
    .eq('type_id', typeId)
    .single();

  if (error || !data) {
    throw ApiError.notFound('Activity type');
  }

  return success(
    parseRow(
      camelCaseKeys(data),
      activityTypeRowSchema,
      'GET /api/v1/activity-types/[typeId]',
    ),
  );
});

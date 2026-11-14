import { ApiError, handleRoute } from '@/lib/api';

const gone = handleRoute(async () => {
  throw ApiError.gone('The games API has been removed. Use /api/v1/activities.');
});

export const GET = gone;
export const PATCH = gone;
export const DELETE = gone;

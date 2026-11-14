import { ApiError, handleRoute } from '@/lib/api';

const handler = handleRoute(async () => {
  throw ApiError.gone('The game proxy has been removed. Use /api/v1/renderer-proxy/activity-renderers/...');
});

export function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handler(request, context as unknown as { params: Promise<Record<string, string>> });
}

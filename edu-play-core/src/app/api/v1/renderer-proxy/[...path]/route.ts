import { NextResponse } from 'next/server';
import { ApiError, handleRoute } from '@/lib/api';

/**
 * Proxy for Activity renderer assets stored in Supabase Storage.
 *
 * Supabase Storage serves HTML as text/plain (XSS protection), which prevents
 * renderer bundles from executing in iframes. This route fetches from Storage
 * and re-serves with the correct Content-Type.
 *
 * URL pattern: /api/v1/renderer-proxy/activity-renderers/multiple-choice/index.html
 *            → /storage/v1/object/public/activity-renderers/multiple-choice/index.html
 */

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

function getContentType(path: string): string {
  const ext = `.${path.split('.').pop()?.toLowerCase()}`;
  return CONTENT_TYPES[ext] || 'application/octet-stream';
}

const handler = handleRoute(async (_request, context) => {
  const params = (await context?.params) as { path?: string[] } | undefined;
  const requestedPath = params?.path?.join('/');

  if (!requestedPath) {
    throw ApiError.notFound('Renderer asset');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new ApiError('INTERNAL_ERROR', 'Supabase URL not configured');
  }

  try {
    const response = await fetchStorageAsset(supabaseUrl, requestedPath);
    if (response) return response;

    return new NextResponse(null, { status: 404 });
  } catch {
    throw new ApiError('INTERNAL_ERROR', 'Failed to fetch renderer asset');
  }
});

async function fetchStorageAsset(supabaseUrl: string, requestedPath: string): Promise<NextResponse | null> {
  const response = await fetch(storageUrl(supabaseUrl, requestedPath));
  if (response.ok) {
    return proxyResponse(response, requestedPath);
  }

  if (!isActivityHostAppRoute(requestedPath)) {
    return new NextResponse(null, { status: response.status });
  }

  const fallbackPath = 'activity-renderers/activity-host/index.html';
  const fallbackResponse = await fetch(storageUrl(supabaseUrl, fallbackPath));
  if (!fallbackResponse.ok) {
    return new NextResponse(null, { status: fallbackResponse.status });
  }

  return proxyResponse(fallbackResponse, fallbackPath);
}

async function proxyResponse(response: Response, storagePath: string): Promise<NextResponse> {
  const body = await response.arrayBuffer();
  const contentType = getContentType(storagePath);

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl(storagePath),
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function cacheControl(storagePath: string): string {
  const contentType = getContentType(storagePath);
  if (contentType.startsWith('text/html') || contentType.startsWith('application/json')) {
    return 'no-store, max-age=0';
  }
  return 'public, max-age=31536000, immutable';
}

function storageUrl(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${storagePath}`;
}

function isActivityHostAppRoute(storagePath: string): boolean {
  const parts = storagePath.split('/');
  const lastSegment = parts[parts.length - 1] ?? '';
  return /^activity-renderers\/activity-host\/(activities|templates)\//.test(storagePath)
    && !lastSegment.includes('.');
}

export function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return handler(request, context as unknown as { params: Promise<Record<string, string>> });
}

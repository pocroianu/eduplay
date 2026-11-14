import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

function context(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

describe('renderer proxy route', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.local';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
  });

  it('serves the Activity host index for client-side Activity host routes', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response('<html>host</html>', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request('http://localhost/api/v1/renderer-proxy/activity-renderers/activity-host/templates/multiple-choice'),
      context(['activity-renderers', 'activity-host', 'templates', 'multiple-choice']),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(await response.text()).toBe('<html>host</html>');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://supabase.local/storage/v1/object/public/activity-renderers/activity-host/templates/multiple-choice',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://supabase.local/storage/v1/object/public/activity-renderers/activity-host/index.html',
    );
  });

  it('allows immutable caching only for fingerprinted renderer assets', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('console.log("ok")', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request('http://localhost/api/v1/renderer-proxy/activity-renderers/activity-host/assets/index-abc123.js'),
      context(['activity-renderers', 'activity-host', 'assets', 'index-abc123.js']),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/javascript; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  });

  it('does not cache Activity host JSON manifests across seed rebuilds', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request('http://localhost/api/v1/renderer-proxy/activity-renderers/activity-host/activities/animals-habitat-01/versions/1/assets.json'),
      context(['activity-renderers', 'activity-host', 'activities', 'animals-habitat-01', 'versions', '1', 'assets.json']),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
  });
});

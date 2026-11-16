import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withArtifactMedia } from './with-artifact-media';

describe('Portfolio media read interface', () => {
  it('isolates returned and thrown failures, and signs repeated paths once', async () => {
    const sign = vi.fn(async (path: string) => {
      if (path === 'throw') throw new Error('offline');
      if (path === 'error')
        return { data: null, error: { message: 'unavailable' } };
      return { data: { signedUrl: 'signed:' + path }, error: null };
    });
    const client = {
      storage: { from: vi.fn(() => ({ createSignedUrl: sign })) },
    } as unknown as SupabaseClient;
    const rows = [
      { id: 1, storagePath: 'ok' },
      { id: 2, storagePath: 'throw' },
      { id: 3, storagePath: 'error' },
      { id: 4, storagePath: 'ok' },
    ];
    expect(await withArtifactMedia(client, rows, 120)).toEqual([
      { ...rows[0], mediaUrl: 'signed:ok' },
      { ...rows[1], mediaUrl: null },
      { ...rows[2], mediaUrl: null },
      { ...rows[3], mediaUrl: 'signed:ok' },
    ]);
    expect(sign).toHaveBeenCalledTimes(3);
    expect(sign).toHaveBeenCalledWith('ok', 120);
    expect(await withArtifactMedia(client, [])).toEqual([]);
    expect(sign).toHaveBeenCalledTimes(3);
  });
});

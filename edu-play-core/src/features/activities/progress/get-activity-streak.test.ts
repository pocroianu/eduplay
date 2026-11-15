import { createClient } from '@supabase/supabase-js';
import { expect, it, vi } from 'vitest';
import type { Database } from '@/shared/types/database';
import { getActivityStreak } from './get-activity-streak';

it('reads beyond the server page limit instead of truncating a long streak', async () => {
  const today = Date.parse('2026-11-15T00:00:00Z');
  const days = Array.from({ length: 1001 }, (_, index) => ({
    active_day: new Date(today - index * 86_400_000).toISOString().slice(0, 10),
  }));
  const fetch = vi.fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify(days.slice(0, 1000)), { headers: { 'Content-Type': 'application/json' } }))
    .mockResolvedValueOnce(new Response(JSON.stringify(days.slice(1000)), { headers: { 'Content-Type': 'application/json' } }));
  const client = createClient<Database>('https://example.test', 'test-key', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
  });
  expect(await getActivityStreak(client, 'learner', new Date('2026-11-15T12:00:00Z'))).toBe(1001);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(new URL(String(fetch.mock.calls[1][0])).searchParams.get('offset')).toBe('1000');
});

it('does not present a failed history read as a zero-day streak', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ message: 'unavailable' }), { status: 403 }));
  const client = createClient<Database>('https://example.test', 'test-key', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false },
  });
  await expect(getActivityStreak(client, 'learner')).rejects.toThrow('Unable to read Activity streak history');
});

import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

import { loadPlaywrightEnv } from '../../tests/e2e/playwright-env';

describe('Playwright environment loading', () => {
  it('loads local Supabase credentials from .env.local when .env is absent', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'eduplay-playwright-env-'));
    const env: Record<string, string | undefined> = {};

    writeFileSync(
      join(cwd, '.env.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=http://localhost:54421',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key',
        'SUPABASE_SERVICE_ROLE_KEY=service-key',
      ].join('\n'),
    );

    try {
      loadPlaywrightEnv({ cwd, env });

      expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://localhost:54421');
      expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('anon-key');
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('service-key');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('keeps explicit process env values ahead of local files', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'eduplay-playwright-env-'));
    const env: Record<string, string | undefined> = {
      NEXT_PUBLIC_SUPABASE_URL: 'http://existing.local',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'existing-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'existing-service',
    };

    writeFileSync(
      join(cwd, '.env.local'),
      [
        'NEXT_PUBLIC_SUPABASE_URL=http://localhost:54421',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key',
        'SUPABASE_SERVICE_ROLE_KEY=service-key',
      ].join('\n'),
    );

    try {
      loadPlaywrightEnv({ cwd, env });

      expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('http://existing.local');
      expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('existing-anon');
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe('existing-service');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

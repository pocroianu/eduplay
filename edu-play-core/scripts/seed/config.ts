import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { config as loadEnv } from 'dotenv';

// Load .env.local if present
loadEnv({ path: '.env.local' });

const SUPABASE_URL = 'http://127.0.0.1:54421';

function getServiceRoleKey(): string {
  // Try env var first
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  // Auto-detect from local Supabase — try multiple command variants
  const commands = ['supabase status -o json', 'npx supabase status -o json'];
  for (const cmd of commands) {
    try {
      const output = execSync(cmd, {
        encoding: 'utf-8',
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const status = JSON.parse(output);
      if (status.SERVICE_ROLE_KEY) {
        return status.SERVICE_ROLE_KEY;
      }
    } catch {
      // Try next command
    }
  }

  throw new Error(
    'Could not determine Supabase service role key. ' +
    'Set SUPABASE_SERVICE_ROLE_KEY env var or ensure Supabase is running locally.'
  );
}

let _client: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (!_client) {
    const serviceRoleKey = getServiceRoleKey();
    _client = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _client;
}

export function log(message: string): void {
  console.log(`  ${message}`);
}

export function logSection(title: string): void {
  console.log(`\n🔧 ${title}`);
}

export function logSuccess(message: string): void {
  console.log(`  ✅ ${message}`);
}

export function logSkip(message: string): void {
  console.log(`  ⏭️  ${message}`);
}

export function logError(message: string): void {
  console.error(`  ❌ ${message}`);
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('reorder_learning_path_steps migration', () => {
  it('locks the parent path row while checking draft status', () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260515002000_learning_path_step_reorder_rpc.sql',
      ),
      'utf8',
    );

    expect(migration).toMatch(
      /SELECT lp\.status\s+INTO v_path_status\s+FROM public\.learning_paths lp\s+WHERE lp\.id = p_path_id\s+FOR UPDATE;/,
    );
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function migration(name: string): string {
  return readFileSync(join(root, 'supabase', 'migrations', name), 'utf8');
}

describe('activity_instances RLS shape', () => {
  it('keeps student access read-only while adding learning-path source linkage', () => {
    const base = migration('20260501100000_create_activity_instances.sql');
    const sourceLink = migration(
      '20260514143000_activity_instance_source_learning_path_step.sql',
    );

    expect(base).toMatch(
      /CREATE POLICY "Students can view assigned activity_instances" ON activity_instances\s+FOR SELECT USING \(auth\.uid\(\) = assigned_to\);/m,
    );
    expect(base).not.toMatch(
      /CREATE POLICY "Students[^"]+" ON activity_instances\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)/m,
    );
    expect(sourceLink).toContain('source_learning_path_step_id');
    expect(sourceLink).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_instances_source_step_assigned_to_unique\s+ON activity_instances\(source_learning_path_step_id, assigned_to\)\s+WHERE source_learning_path_step_id IS NOT NULL;/m,
    );
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function migration(name: string): string {
  return readFileSync(join(root, 'supabase', 'migrations', name), 'utf8');
}

describe('activity_instances RLS shape', () => {
  it('keeps student access read-only while adding learning-path source linkage', () => {
    const base = migration('20261116225053_baseline.sql');

    expect(base).toMatch(
      /CREATE POLICY "Students can view assigned activity_instances" ON "public"\."activity_instances" FOR SELECT USING \(\("auth"\."uid"\(\) = "assigned_to"\)\);/m,
    );
    expect(base).not.toMatch(
      /CREATE POLICY "Students[^"]+" ON "public"\."activity_instances"\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)/m,
    );
    expect(base).toMatch(
      /CREATE UNIQUE INDEX "idx_activity_instances_source_step_assigned_to_unique" ON "public"\."activity_instances" USING "btree" \("source_learning_path_step_id", "assigned_to"\) WHERE \("source_learning_path_step_id" IS NOT NULL\);/m,
    );
  });
});

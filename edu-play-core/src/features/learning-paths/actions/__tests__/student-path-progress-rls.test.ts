import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20261116225053_baseline.sql'),
  'utf8',
);

describe('student_path_progress RLS', () => {
  it('keeps student sessions read-only for path progress rows', () => {
    const studentPathProgressPolicies = migrationSql.matchAll(
      /CREATE POLICY "Students [^"]*path_progress" ON "public"\."student_path_progress"\s+FOR\s+([A-Z]+)/g,
    );

    expect([...studentPathProgressPolicies].map((match) => match[1])).toEqual([
      'SELECT',
    ]);
  });

  it('does not document student-session auto-progression writes', () => {
    expect(migrationSql).not.toContain(
      'auto-progression uses these policies via',
    );
  });
});

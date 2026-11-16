import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261116225053_baseline.sql',
);

function migrationSql() {
  return readFileSync(migrationPath, 'utf8');
}

describe('teacher upload artifact migration policy', () => {
  it('requires inserted child_artifacts.student_id to be one of the teacher students', () => {
    expect(migrationSql()).toMatch(
      /"student_id"\s+IN\s*\(\s*SELECT\s+"public"\."get_teacher_student_ids"\("auth"\."uid"\(\)\)/i,
    );
  });

  it('requires child_artifacts.storage_path to live under the inserted student id folder', () => {
    expect(migrationSql()).toMatch(
      /\("storage"\."foldername"\("storage_path"\)\)\[1\]\)::"uuid"\s*=\s*"student_id"/i,
    );
  });
});

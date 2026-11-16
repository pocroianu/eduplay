import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const LEGACY_DUPLICATE_PREFIXES = new Set([
  // Existing same-version migration pairs that predate this guard and include
  // the repo-standard Supabase CLI dedup workaround.
  '20260417000000',
  '20260501100000',
])

describe('Supabase migration filenames', () => {
  it('does not add new duplicate migration version prefixes', () => {
    const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
    const prefixesByVersion = new Map<string, string[]>()

    for (const filename of readdirSync(migrationsDir)) {
      const match = filename.match(/^(\d+)_.*\.sql$/)
      if (!match) continue

      const [, version] = match
      const existing = prefixesByVersion.get(version) ?? []
      prefixesByVersion.set(version, [...existing, filename])
    }

    const newDuplicatePrefixes = Array.from(prefixesByVersion.entries())
      .filter(
        ([version, filenames]) =>
          filenames.length > 1 && !LEGACY_DUPLICATE_PREFIXES.has(version)
      )
      .map(([version, filenames]) => `${version}: ${filenames.join(', ')}`)

    expect(newDuplicatePrefixes).toEqual([])
  })

  it('keeps the squashed baseline recorded as applied', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase',
      'migrations',
      '20261116225053_baseline.sql'
    )
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).not.toMatch(
      /DELETE\s+FROM\s+supabase_migrations\.schema_migrations[\s\S]*20261116225053/i
    )
  })

  it('guards parent consent flags against broad student row update policies', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase',
      'migrations',
      '20261116225053_baseline.sql'
    )
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+"public"\."enforce_parent_only_student_consents"/i
    )
    expect(migration).toMatch(
      /BEFORE\s+UPDATE\s+OF\s+"consents"\s+ON\s+"public"\."students"/i
    )
    expect(migration).toMatch(
      /current_setting\('eduplay\.allow_child_consent_update',\s*true\)/i
    )
    expect(migration).toMatch(
      /RAISE\s+EXCEPTION\s+'students\.consents is parent-only'/i
    )
    expect(migration).toMatch(
      /set_config\('eduplay\.allow_child_consent_update',\s*'on',\s*true\)/i
    )
  })

  it('requires the set_child_consent RPC caller to have the parent role', () => {
    const migrationPath = join(
      process.cwd(),
      'supabase',
      'migrations',
      '20261116225053_baseline.sql'
    )
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).toMatch(/v_caller_role\s+TEXT/i)
    expect(migration).toMatch(/SELECT\s+role\s+INTO\s+v_caller_role/i)
    expect(migration).toMatch(/FROM\s+profiles/i)
    expect(migration).toMatch(/WHERE\s+id\s+=\s+auth\.uid\(\)/i)
    expect(migration).toMatch(/v_caller_role\s+IS\s+DISTINCT\s+FROM\s+'parent'/i)
  })
})

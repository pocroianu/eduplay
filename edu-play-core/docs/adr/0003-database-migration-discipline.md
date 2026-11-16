# Keep database schema authority in SQL migrations

EduPlay's database architecture is Supabase-native: Postgres tables, Row Level Security, storage policies, triggers, audit hooks, `SECURITY DEFINER` helpers, and RPCs define important security and domain behavior. We decided that raw SQL migrations in `supabase/migrations/` remain the canonical source of truth for schema changes. Generated Supabase types are derived output, and application/Zod types validate boundaries but do not define the database contract.

## Decision

- Keep `supabase/migrations/*.sql` as the only database schema authority.
- Do not introduce Prisma or Drizzle as a schema or migration authority.
- Prisma is not a good fit for this project because it does not naturally model Supabase RLS, storage policies, grants, triggers, and privilege-aware RPCs.
- Drizzle may be considered later only as a typed query builder for narrow service-role/reporting use cases; it must not own migrations or duplicate the schema contract.

## Baseline squash (2026-11-16)

The prior migrations were squashed into `supabase/migrations/20261116225053_baseline.sql`. No production or hosted database existed. A clean `db reset` was broken: Directus bootstrap needed role membership, and `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` cannot run as the non-superuser `postgres`. Duplicate prefixes `20260417000000` and `20260501100000` also broke migration history. Migrations are forward-only from this baseline; new migration timestamps must follow it.

When squashing, `supabase db dump` omits revokes relative to Supabase default privileges. Verify ACLs with a full schema-only `pg_dump` diff across all schemas, connecting as `supabase_admin` to both databases. Use matching PostgreSQL client versions and substitute the database URLs:

```bash
pg_dump --schema-only --username=supabase_admin --dbname="$OLD_DB_URL" > old-schema.sql
pg_dump --schema-only --username=supabase_admin --dbname="$BASELINE_DB_URL" > baseline-schema.sql
diff -u old-schema.sql baseline-schema.sql
```

Review any differences, including ACLs, before accepting a squash. Account for nondeterministic dump metadata such as `\restrict` keys when comparing dumps.

## Migration discipline

- Migrations are forward-only once applied/shared. Do not edit old migrations except to fix an unmerged broken branch.
- Each migration file uses a unique timestamp prefix: `YYYYMMDDHHMMSS_descriptive_name.sql`.
- No new duplicate migration prefixes are allowed.
- Prefer one vertical domain-slice migration per change, containing the table/column changes, constraints, indexes, RLS, helper functions/RPCs, triggers, comments, grants, and required schema-coupled backfill.
- Split risky changes into expand → compatible read/write or dual-write → backfill → tighten → contract.
- Required DB correctness belongs in migrations, not in `npm run seed`. Demo/local baseline data and external renderer/catalog imports belong in TypeScript seed/import scripts.

## RLS and security rules

- Every new table is incomplete until RLS is enabled and explicit policies are defined in the same migration.
- Avoid temporary broad policies such as `USING (true)` for app-accessible tables.
- Never grant broad visibility with blanket `column IS NULL` predicates.
- Cross-table RLS checks should use `SECURITY DEFINER` helpers when direct joins risk recursion.
- Add targeted indexes for RLS predicates and common policy lookup paths.

`SECURITY DEFINER` functions and privilege-aware RPCs should use an explicit template:

```sql
CREATE OR REPLACE FUNCTION public.some_function(...)
RETURNS ...
LANGUAGE sql -- or plpgsql
STABLE -- when possible
SECURITY DEFINER
SET search_path = public
AS $$
  ...
$$;
```

Callable RPCs must revoke public execution and grant least privilege explicitly:

```sql
REVOKE ALL ON FUNCTION public.some_function(...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.some_function(...) TO authenticated;
```

Mutating RPCs must validate caller role and ownership internally, not rely only on client behavior.

## Invariants, RPCs, and application code

The database owns invariants and privacy/security boundaries:

- foreign keys, uniqueness, checks, and status constraints
- RLS ownership and visibility rules
- audit triggers
- immutable/versioning guarantees
- parent/teacher/student access boundaries
- atomic privilege-aware mutations

Application code owns workflow and presentation concerns:

- form validation and user-friendly errors
- multi-step UX orchestration
- rendering decisions and non-security feature flags
- derived display state

Use RPCs for complex atomic writes such as publishing Activity Versions, reordering learning path steps, assigning version-pinned Activities, consent updates, artifact visibility transitions, and multi-table mutations. Use normal Supabase client CRUD for simple single-table writes where RLS is sufficient.

## Auditability, enums, deletes, and versions

Database-level audit logging is required for privacy/compliance-sensitive events, including child artifact lifecycle changes, parent consent changes, deletion requests/hard-delete flows, admin feature flag changes, Activity publish/unpublish/version publish actions, assignment changes affecting children, parent-child link changes, and roster changes where applicable. High-volume progress telemetry should not become audit log noise unless required for parent-visible history or compliance.

Use Postgres enums for shared, stable domain values used across tables or policies. Use `TEXT CHECK (...)` for feature-local or still-evolving workflow states. Avoid unconstrained status text.

Default to soft delete/archive/unpublish for child-facing or history-bearing records. Hard delete is reserved for explicit privacy/account-deletion flows. Choose `ON DELETE RESTRICT`, `SET NULL`, or `CASCADE` deliberately based on whether dependent rows have standalone audit/history value.

Published or assigned `activity_versions` are immutable at the database layer. Assignments must pin `version_id`; edits create a new version rather than mutating the assigned/published one.

## Required verification for schema changes

For migrations touching tables, views, functions, enums, or storage schema, run and commit the results of:

```bash
npx supabase db reset
npm run generate:types
npm run check:types-drift
npm run test:unit
```

Commit the migration, updated `src/shared/types/database.ts`, and any required Zod/query/test updates together.

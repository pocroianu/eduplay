-- Bootstrap for Directus CMS integration (Phase 1).
--
-- Directus runs as a self-hosted Docker service against this Postgres. It needs:
--   1. A dedicated schema (`directus`) for its ~20 system tables, so they don't
--      pollute `public`.
--   2. A dedicated Postgres role (`directus_admin`) that:
--        - Owns the `directus` schema (full DDL there).
--        - Has DML on app tables in `public` (insert/update/delete rows).
--        - Has BYPASSRLS so Directus' own permission system gates authoring
--          (RLS is enforced for Supabase Auth users on the runtime side; Directus
--          is an admin-only surface).
--        - Has NO DDL on `public` — schema changes flow through migrations only.
--
-- The role is created with NOLOGIN. Operators MUST run, out-of-band, e.g.:
--
--     ALTER ROLE directus_admin WITH LOGIN PASSWORD '<secret>';
--
-- before pointing Directus at the database. This prevents an unsecured Directus
-- instance from authenticating against any environment where this migration runs.

-- ---------- role ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'directus_admin') THEN
    CREATE ROLE directus_admin NOLOGIN BYPASSRLS;
  END IF;
END
$$;

-- On Supabase Postgres 15 the migration role (`postgres`) is not a superuser,
-- so `CREATE SCHEMA ... AUTHORIZATION directus_admin` requires it to be a
-- member of `directus_admin`. Grant that membership idempotently.
DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'directus_admin', 'MEMBER') THEN
    EXECUTE format('GRANT directus_admin TO %I', current_user);
  END IF;
END
$$;

-- ---------- schema ----------
CREATE SCHEMA IF NOT EXISTS directus AUTHORIZATION directus_admin;

GRANT USAGE, CREATE ON SCHEMA directus TO directus_admin;

-- ---------- public schema access (DML only, no DDL) ----------
-- Allow the role to see `public` and use sequences for inserts.
GRANT USAGE ON SCHEMA public TO directus_admin;

-- DML on all current tables in `public`. Repeat for future tables via
-- DEFAULT PRIVILEGES below.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO directus_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO directus_admin;

-- Future tables created in `public` (by future migrations) automatically get
-- the same DML grants. Note: this only applies to tables created by roles that
-- match the FOR ROLE clause. We grant for `postgres` (CLI migrations) and
-- `supabase_admin` (Supabase platform). Altering another role's default
-- privileges requires membership in it, so roles the migration user cannot
-- act as (e.g. `supabase_admin` when migrating as `postgres`) are skipped.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['postgres', 'supabase_admin']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r)
       AND pg_has_role(current_user, r, 'MEMBER') THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO directus_admin',
        r
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO directus_admin',
        r
      );
    END IF;
  END LOOP;
END
$$;

-- ---------- explicit DDL denial in `public` ----------
-- USAGE alone does not grant CREATE on a schema, but other roles may have
-- previously granted it. Be explicit.
REVOKE CREATE ON SCHEMA public FROM directus_admin;

-- ---------- sensitive tables: revoke ----------
-- Directus must not read or modify these even from the admin Data Studio.
-- The list errs on the side of caution; loosen per-table as Phase 2 migrates
-- specific admin surfaces and we know the access pattern.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs',
    'password_reset_requests',
    'activity_preview_sessions',
    'child_artifacts',
    'parent_invite_codes',
    'deletion_requests'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM directus_admin', t);
    END IF;
  END LOOP;
END
$$;

COMMENT ON ROLE directus_admin IS
  'Directus CMS service account. BYPASSRLS, DML on public tables, owns the directus schema. No DDL on public — schema migrations remain the source of truth.';

COMMENT ON SCHEMA directus IS
  'Holds Directus system tables (directus_users, directus_collections, directus_permissions, etc). Owned by directus_admin; do not edit by hand.';

-- Supabase CLI dedup workaround
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE format('DELETE FROM supabase_migrations.schema_migrations WHERE version = %L', '20260528000000');
  END IF;
END
$wa$;

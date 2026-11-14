# Migrations

## Authoring new migrations

Every new migration file must:

1. Be idempotent. Use `CREATE ... IF NOT EXISTS`, `DROP POLICY IF EXISTS`, and
   guarded `DO $$ ... $$;` blocks for things the base SQL cannot express as
   `IF NOT EXISTS` (e.g. `ALTER TABLE ... ADD CONSTRAINT`). This lets the
   migration run cleanly against a fresh DB or a partially-applied one.

2. End with the Supabase CLI dedup workaround:

   ```sql
   -- Supabase CLI dedup workaround
   DO $wa$
   BEGIN
     IF EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
     ) THEN
       EXECUTE format('DELETE FROM supabase_migrations.schema_migrations WHERE version = %L', '<version>');
     END IF;
   END
   $wa$;
   ```

   ### Why this exists

   On Apr 16 2026 (session S188) the local Supabase stack started failing at
   startup with `duplicate key value violates unique constraint
   "schema_migrations_pkey"`. The CLI re-runs the full migration set on every
   `supabase start`, then tries to insert the version row into
   `supabase_migrations.schema_migrations`. If the row already exists the whole
   migration aborts, even though the DDL succeeded. The self-cleaning DELETE
   deletes the stale version row just before the CLI tries to insert it, so
   the insert succeeds.

   The guard around `information_schema.tables` ensures the block is a no-op
   when the migration runs against a non-CLI environment (e.g. production
   PostgREST) where the `supabase_migrations` schema does not exist.

   Replace `<version>` with this file's numeric prefix (e.g. `20260417000001`).

## Security note on SECURITY DEFINER functions

Functions declared `SECURITY DEFINER` inherit `EXECUTE` grants from `PUBLIC`
by default. **Every `SECURITY DEFINER` function that should not be callable
by authenticated end-users must explicitly revoke and re-grant execute**:

```sql
REVOKE EXECUTE ON FUNCTION my_sensitive_fn() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION my_sensitive_fn() TO service_role;
```

Example: `20260417000001_hard_delete_user.sql`.

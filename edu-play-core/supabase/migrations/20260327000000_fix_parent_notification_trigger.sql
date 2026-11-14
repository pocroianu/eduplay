-- Fix: parent_notification_preferences trigger fails when called from GoTRUE auth service
-- The supabase_auth_admin role has search_path=auth, so the trigger function
-- needs explicit public schema qualification and SET search_path = public.

CREATE OR REPLACE FUNCTION create_parent_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'parent' THEN
    INSERT INTO public.parent_notification_preferences (parent_id)
    VALUES (NEW.id)
    ON CONFLICT (parent_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260327000000''';
  END IF;
END
$wa$;

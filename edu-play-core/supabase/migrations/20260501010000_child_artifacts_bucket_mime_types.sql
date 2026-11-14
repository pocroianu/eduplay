-- Lock down child-artifacts bucket allowed MIME types + file size limit
-- (F9 Phase 1D — EDU-292). The bucket was created in EDU-271 without explicit
-- limits, so it accepts any MIME and file size today. Enumerate the kinds we
-- actually support (PNG drawings, WebM/OGG audio recordings) and cap files at
-- 10 MB so abusive uploads fail at the storage layer before our action ever
-- runs.

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['image/png', 'audio/webm', 'audio/ogg']::text[],
  file_size_limit = 10 * 1024 * 1024
WHERE id = 'child-artifacts';

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260501010000''';
  END IF;
END
$wa$;

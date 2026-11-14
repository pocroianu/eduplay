-- Storage Setup for Assets Bucket
-- Adds an assets bucket for game assets (images, sounds, etc.)

-- Ensure games bucket exists (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('games', 'games', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to assets bucket
DROP POLICY IF EXISTS "Public read access for assets" ON storage.objects;
CREATE POLICY "Public read access for assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

-- Allow authenticated users (teachers/admins) to upload assets
DROP POLICY IF EXISTS "Teachers can upload assets" ON storage.objects;
CREATE POLICY "Teachers can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assets'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('teacher', 'admin')
  )
);

-- Allow teachers/admins to update their uploaded assets
DROP POLICY IF EXISTS "Teachers can update assets" ON storage.objects;
CREATE POLICY "Teachers can update assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assets'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('teacher', 'admin')
  )
);

-- Allow teachers/admins to delete assets
DROP POLICY IF EXISTS "Teachers can delete assets" ON storage.objects;
CREATE POLICY "Teachers can delete assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assets'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('teacher', 'admin')
  )
);

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260413000000''';
  END IF;
END
$wa$;

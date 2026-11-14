-- Supabase Storage Setup for Games
-- Run this in Supabase SQL Editor after schema.sql

-- Create storage bucket for games
INSERT INTO storage.buckets (id, name, public)
VALUES ('games', 'games', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to games bucket
DROP POLICY IF EXISTS "Public read access for games" ON storage.objects;
CREATE POLICY "Public read access for games"
ON storage.objects FOR SELECT
USING (bucket_id = 'games');

-- Allow authenticated users (teachers/admins) to upload games
DROP POLICY IF EXISTS "Teachers can upload games" ON storage.objects;
CREATE POLICY "Teachers can upload games"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'games'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('teacher', 'admin')
  )
);

-- Allow teachers/admins to update their uploaded games
DROP POLICY IF EXISTS "Teachers can update games" ON storage.objects;
CREATE POLICY "Teachers can update games"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'games'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('teacher', 'admin')
  )
);

-- Allow teachers/admins to delete games
DROP POLICY IF EXISTS "Teachers can delete games" ON storage.objects;
CREATE POLICY "Teachers can delete games"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'games'
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
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260107000001''';
  END IF;
END
$wa$;

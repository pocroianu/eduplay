-- Child artifacts storage bucket + RLS policies (F6 Phase 1A — EDU-271)
-- Mirrors the row-level RLS on public.child_artifacts so that storage object access
-- matches artifact access. The bucket is private; reads must go through
-- short-lived signed URLs created by the server-side helper.
--
-- Path convention: '<student_id>/<filename>' — the first folder MUST be the
-- student's id so the storage RLS can join back to public.child_artifacts via
-- storage_path == storage.objects.name.
--
-- Rollback (manual, ops reference only):
--   DROP POLICY IF EXISTS "Students insert own child artifacts"      ON storage.objects;
--   DROP POLICY IF EXISTS "Teachers select class child artifacts"    ON storage.objects;
--   DROP POLICY IF EXISTS "Teachers update class child artifacts"    ON storage.objects;
--   DROP POLICY IF EXISTS "Teachers delete class child artifacts"    ON storage.objects;
--   DROP POLICY IF EXISTS "Parents select family-visible artifacts"  ON storage.objects;
--   DROP POLICY IF EXISTS "Admins manage child artifacts"            ON storage.objects;
--   DELETE FROM storage.objects WHERE bucket_id = 'child-artifacts';
--   DELETE FROM storage.buckets WHERE id = 'child-artifacts';

-- 1. Create the private bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('child-artifacts', 'child-artifacts', false)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public;

-- 2. Students INSERT only into a path under their own student id, and only when
--    no object already exists at that path (the unique (bucket_id, name)
--    constraint on storage.objects gives us this naturally; the WITH CHECK
--    only authorises the path).
--
--    The path-folder check alone would let any authenticated user (teachers,
--    parents, admins) write under their own UID folder — defeating the policy
--    intent — so we additionally require the caller's profile.role = 'student'.
--    students.id REFERENCES profiles.id REFERENCES auth.users.id, so auth.uid()
--    on a student session is the same UUID used for the path folder.
DROP POLICY IF EXISTS "Students insert own child artifacts" ON storage.objects;
CREATE POLICY "Students insert own child artifacts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'child-artifacts'
  AND auth.role() = 'authenticated'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'student'
  )
);

-- 3. Teachers can SELECT/UPDATE/DELETE artifacts for students in their classes.
--    The first folder of the path is the student id, so we cross-check it
--    against get_teacher_student_ids() (already SECURITY DEFINER, used by the
--    public.child_artifacts RLS).
DROP POLICY IF EXISTS "Teachers select class child artifacts" ON storage.objects;
CREATE POLICY "Teachers select class child artifacts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'child-artifacts'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT public.get_teacher_student_ids(auth.uid())
  )
);

DROP POLICY IF EXISTS "Teachers update class child artifacts" ON storage.objects;
CREATE POLICY "Teachers update class child artifacts"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'child-artifacts'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT public.get_teacher_student_ids(auth.uid())
  )
);

DROP POLICY IF EXISTS "Teachers delete class child artifacts" ON storage.objects;
CREATE POLICY "Teachers delete class child artifacts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'child-artifacts'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT public.get_teacher_student_ids(auth.uid())
  )
);

-- 4. Parents can SELECT only family_visible artifacts of their linked children.
--    We gate by joining storage.objects.name → public.child_artifacts.storage_path
--    and requiring visibility = 'family_visible'.
DROP POLICY IF EXISTS "Parents select family-visible artifacts" ON storage.objects;
CREATE POLICY "Parents select family-visible artifacts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'child-artifacts'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1
    FROM public.child_artifacts ca
    WHERE ca.storage_path = storage.objects.name
      AND ca.visibility = 'family_visible'
      AND ca.student_id IN (SELECT public.get_parent_student_ids(auth.uid()))
  )
);

-- 5. Admins: full access (FOR ALL covers SELECT/INSERT/UPDATE/DELETE).
DROP POLICY IF EXISTS "Admins manage child artifacts" ON storage.objects;
CREATE POLICY "Admins manage child artifacts"
ON storage.objects FOR ALL
USING (
  bucket_id = 'child-artifacts'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'child-artifacts'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260501000000''';
  END IF;
END
$wa$;

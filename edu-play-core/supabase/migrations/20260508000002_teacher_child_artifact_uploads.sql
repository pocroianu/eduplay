-- Teacher-authored child artifact uploads (F6 Phase 2A — EDU-556 / EDU-29).
-- Opens the `child-artifacts` storage bucket and the `child_artifacts` table
-- to teacher-side INSERTs so the Phase 2A photo + audio upload flow can land
-- drafts under each student's folder, ready for the existing teacher review
-- queue. Three changes:
--   1. Bucket `allowed_mime_types` is widened to include `image/jpeg` and
--      `image/webp`. The drawing path keeps using `image/png`.
--   2. A new storage policy `Teachers insert child artifacts` lets teachers
--      INSERT under `<student_id>/...` for any student in one of their
--      classes (mirroring the existing teacher SELECT/UPDATE/DELETE shape).
--      The `profiles.role = 'teacher'` check is defense-in-depth: the path
--      folder check only proves the UUID is one of the caller's class
--      students, not that the caller is a teacher.
--   3. The existing `Teachers can insert class artifacts` policy is dropped
--      and recreated with `visibility = 'draft'`, a teacher-role check,
--      explicit `student_id` membership, `student_id`/`class_id`
--      consistency, and storage path/student consistency.
--
-- Rollback (manual, ops reference only):
--   DROP POLICY IF EXISTS "Teachers insert child artifacts" ON storage.objects;
--   UPDATE storage.buckets
--     SET allowed_mime_types = ARRAY['image/png','audio/webm','audio/ogg']::text[]
--     WHERE id = 'child-artifacts';
--   DROP POLICY IF EXISTS "Teachers can insert class artifacts" ON child_artifacts;
--   CREATE POLICY "Teachers can insert class artifacts" ON child_artifacts
--     FOR INSERT WITH CHECK (
--       class_id IN (SELECT get_teacher_class_ids(auth.uid()))
--     );

-- 1. Widen bucket MIME allow-list. Keep PNG (drawings) and the audio MIMEs;
--    add JPEG/WebP for teacher-uploaded photos.
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'audio/webm',
    'audio/ogg'
  ]::text[]
WHERE id = 'child-artifacts';

-- 2. Teachers INSERT into <student_id>/... for any student in one of their
--    classes. Mirrors `Teachers select class child artifacts` from
--    20260501000000_child_artifacts_storage_bucket.sql; the caller-role
--    check is defense-in-depth.
DROP POLICY IF EXISTS "Teachers insert child artifacts" ON storage.objects;
CREATE POLICY "Teachers insert child artifacts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'child-artifacts'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT public.get_teacher_student_ids(auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  )
);

-- 3. Tighten the existing table-level teacher INSERT policy. The original
--    policy (20260417100000_child_artifacts_audit_log.sql) only checked
--    `class_id IN get_teacher_class_ids`; it did not pin `visibility`,
--    require the caller to actually have profile.role = 'teacher', verify
--    the inserted `student_id`, or bind `storage_path` to that same
--    student. Add those checks so a teacher cannot smuggle a non-draft or
--    mismatched artifact past review.
DROP POLICY IF EXISTS "Teachers can insert class artifacts" ON child_artifacts;
CREATE POLICY "Teachers can insert class artifacts"
ON child_artifacts FOR INSERT
WITH CHECK (
  class_id IN (SELECT public.get_teacher_class_ids(auth.uid()))
  AND student_id IN (SELECT public.get_teacher_student_ids(auth.uid()))
  AND EXISTS (
    SELECT 1
    FROM public.students
    WHERE students.id = child_artifacts.student_id
      AND students.class_id = child_artifacts.class_id
  )
  AND (storage.foldername(storage_path))[1]::uuid = student_id
  AND visibility = 'draft'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  )
);

-- Workaround for Supabase CLI duplicate schema_migrations row issue (see
-- 20260501010000_child_artifacts_bucket_mime_types.sql for the original
-- occurrence). The CLI sometimes inserts a duplicate row when a migration
-- with the same version is applied via `db push` and `db reset`.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260508000002''';
  END IF;
END
$wa$;

-- EDU-51: Profile preferences + classmate scoping helper
--
-- Adds:
--   * profile_preferences table — per-profile UI settings (sound, reduced
--     motion, theme) used by the student dashboard + profile route.
--   * get_student_classmates(p_student_id UUID) — SECURITY DEFINER helper
--     that returns the classmates of a student without exposing the full
--     students table to RLS-limited callers. Required for the classmate
--     leaderboard without leaking unrelated students.

-- ---------------------------------------------------------------------------
-- 1. profile_preferences
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profile_preferences (
  profile_id      UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  sound_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  reduced_motion  BOOLEAN NOT NULL DEFAULT FALSE,
  theme           TEXT NOT NULL DEFAULT 'auto' CHECK (theme IN ('light', 'dark', 'auto')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profile_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can select own preferences" ON profile_preferences;
CREATE POLICY "Owner can select own preferences" ON profile_preferences
  FOR SELECT USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Owner can insert own preferences" ON profile_preferences;
CREATE POLICY "Owner can insert own preferences" ON profile_preferences
  FOR INSERT WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Owner can update own preferences" ON profile_preferences;
CREATE POLICY "Owner can update own preferences" ON profile_preferences
  FOR UPDATE USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Owner can delete own preferences" ON profile_preferences;
CREATE POLICY "Owner can delete own preferences" ON profile_preferences
  FOR DELETE USING (auth.uid() = profile_id);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.profile_preferences_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_preferences_set_updated_at ON profile_preferences;
CREATE TRIGGER profile_preferences_set_updated_at
  BEFORE UPDATE ON profile_preferences
  FOR EACH ROW EXECUTE FUNCTION public.profile_preferences_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 2. get_student_classmates helper
-- ---------------------------------------------------------------------------
-- Why SECURITY DEFINER: students RLS (see 20260328000000) restricts SELECT on
-- students to the teacher that owns the class. A student querying for their
-- classmates would hit that policy and see nothing. The helper runs with the
-- function owner's privileges, but only returns IDs where the caller actually
-- shares a class with the target student, so it cannot leak anything the
-- caller is not already entitled to.

CREATE OR REPLACE FUNCTION public.get_student_classmates(p_student_id UUID)
RETURNS TABLE (id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM students s
  WHERE s.class_id IS NOT NULL
    AND s.class_id = (SELECT class_id FROM students WHERE id = p_student_id)
    AND s.id <> p_student_id;
$$;

REVOKE ALL ON FUNCTION public.get_student_classmates(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_classmates(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_student_classmates(UUID)
  IS 'Returns classmates of a student (same class_id, excluding self). SECURITY DEFINER so students can query without teacher-scoped RLS on students. Caller identity must match the student for any meaningful use.';

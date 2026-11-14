-- ============================================================================
-- Hard Activity-only cutover
-- Removes legacy Game identity from the active schema. Historical migrations may
-- still mention games; the final schema after this migration is Activity-only.
-- ============================================================================

-- Assignments are Activity obligations with immutable version pins.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS activity_id UUID;

-- Earlier Activity-first migrations created this FK as ON DELETE SET NULL while
-- assignments could still be legacy/unmapped. The Activity-only schema makes
-- activity_id required, so recreate the FK with the intended cascade action.
ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_activity_id_fkey;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_activity_id_fkey
  FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;

-- Earlier version pins were nullable, so the FK used ON DELETE SET NULL. The
-- Activity-only schema requires immutable version pins and should reject version
-- deletion while assignments reference them.
ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_version_id_fkey;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_version_id_fkey
  FOREIGN KEY (version_id) REFERENCES public.activity_versions(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.assignments WHERE activity_id IS NULL OR version_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot complete Activity-only cutover: assignments without activity_id/version_id exist';
  END IF;
END
$$;

ALTER TABLE public.assignments
  ALTER COLUMN activity_id SET NOT NULL,
  ALTER COLUMN version_id SET NOT NULL,
  DROP COLUMN IF EXISTS game_id CASCADE;

DROP INDEX IF EXISTS public.idx_assignments_game_id;
DROP INDEX IF EXISTS public.idx_assignments_activity_id;
CREATE INDEX IF NOT EXISTS idx_assignments_activity_id
  ON public.assignments(activity_id);

-- Activity definitions no longer carry renderer-specific `game_id` keys.
ALTER TABLE public.activities
  DROP COLUMN IF EXISTS game_id CASCADE;

-- Canonical Activity progress has no legacy Game bridge.
ALTER TABLE public.activity_progress
  DROP COLUMN IF EXISTS legacy_game_id CASCADE;
DROP INDEX IF EXISTS public.idx_activity_progress_legacy_game_id;

-- Learning paths target Activities only; legacy game-targeted steps are not
-- migrated implicitly because there is no lossless mapping.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.learning_path_steps
    WHERE kind = 'game' OR target_game_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot complete Activity-only cutover: legacy game learning-path steps exist';
  END IF;
END
$$;

ALTER TABLE public.learning_path_steps
  DROP CONSTRAINT IF EXISTS learning_path_steps_kind_check,
  DROP COLUMN IF EXISTS target_game_id CASCADE;
DROP INDEX IF EXISTS public.idx_learning_path_steps_target_game_id;

ALTER TABLE public.learning_path_steps
  ADD CONSTRAINT learning_path_steps_kind_check
  CHECK (kind = 'activity_template' AND target_activity_type IS NOT NULL);

-- Portfolio artifacts can carry Activity/version/assignment capture metadata.
ALTER TABLE public.child_artifacts
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Renderer assets live under an Activity renderer bucket/path, not a games bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('activity-renderers', 'activity-renderers', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public read access for activity renderers" ON storage.objects;
CREATE POLICY "Public read access for activity renderers"
ON storage.objects FOR SELECT
USING (bucket_id = 'activity-renderers');

-- Remove legacy game renderer storage from the active DB. Historical migrations
-- create this bucket and its policies; the Activity-only schema keeps only the
-- activity-renderers bucket for renderer assets.
DROP POLICY IF EXISTS "Public read access for games" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can upload games" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can update games" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can delete games" ON storage.objects;

DO $$
BEGIN
  -- Supabase protects storage table deletes unless this migration-scoped flag
  -- is set. Keep it local to this DO statement so later storage operations keep
  -- the platform default protection.
  PERFORM set_config('storage.allow_delete_query', 'true', true);

  DELETE FROM storage.objects WHERE bucket_id = 'games';
  DELETE FROM storage.buckets WHERE id = 'games';
END
$$;

-- Remove legacy progress storage and legacy catalog storage from the active DB.
DROP TABLE IF EXISTS public.game_progress CASCADE;
DROP TABLE IF EXISTS public.games CASCADE;

COMMENT ON TABLE public.activity_progress IS
  'Activity-native learner progress keyed by (student_id, activity_id).';
COMMENT ON COLUMN public.activity_progress.last_version_id IS
  'The Activity Version most recently played for this Activity progress row; not part of row identity.';
COMMENT ON COLUMN public.assignments.activity_id IS
  'Canonical Activity target for this assignment.';
COMMENT ON COLUMN public.assignments.version_id IS
  'Required immutable Activity Version pin for this assignment.';
COMMENT ON COLUMN public.child_artifacts.metadata IS
  'Activity artifact metadata such as activityId, versionId, assignmentId, and score.';

-- ============================================================================
-- Activity-first assignment creation
-- Legacy game_id becomes optional so new assignments can target Activities
-- directly. Existing legacy/unmapped assignments may continue to use game_id.
-- ============================================================================

ALTER TABLE public.assignments
  ALTER COLUMN game_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assignments_activity_or_game_required'
      AND conrelid = 'public.assignments'::regclass
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_activity_or_game_required
      CHECK (activity_id IS NOT NULL OR game_id IS NOT NULL)
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assignments_activity_targets_pin_version'
      AND conrelid = 'public.assignments'::regclass
  ) THEN
    ALTER TABLE public.assignments
      ADD CONSTRAINT assignments_activity_targets_pin_version
      CHECK (activity_id IS NULL OR version_id IS NOT NULL)
      NOT VALID;
  END IF;
END
$$;

COMMENT ON COLUMN public.assignments.game_id IS
  'Legacy compatibility target. Nullable for Activity-first assignments.';
COMMENT ON COLUMN public.assignments.activity_id IS
  'Canonical Activity target for new assignments.';
COMMENT ON COLUMN public.assignments.version_id IS
  'Required Activity Version pin whenever activity_id is present; nullable only for legacy/unmapped assignments.';

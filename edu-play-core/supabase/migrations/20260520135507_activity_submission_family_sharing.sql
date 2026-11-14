-- Family sharing semantics for reviewed free-response attempts.
-- Eligibility is derived from the immutable assigned activity version config at
-- approval time. Family-facing comments live in a separate table so students
-- can still read their own attempts without seeing parent-facing notes.

CREATE TABLE IF NOT EXISTS public.activity_submission_family_shares (
  attempt_id UUID PRIMARY KEY REFERENCES public.activity_submission_attempts(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.activity_submissions(id) ON DELETE CASCADE,
  family_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_submission_family_shares_submission
  ON public.activity_submission_family_shares(submission_id);
CREATE INDEX IF NOT EXISTS idx_activity_submission_family_shares_recent
  ON public.activity_submission_family_shares(updated_at DESC, attempt_id);

DROP TRIGGER IF EXISTS update_activity_submission_family_shares_updated_at ON public.activity_submission_family_shares;
CREATE TRIGGER update_activity_submission_family_shares_updated_at
  BEFORE UPDATE ON public.activity_submission_family_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.activity_version_shares_with_family(p_version_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (
      SELECT av.config_data @> '{"shareWithFamilyOnApproval": true}'::jsonb
        FROM public.activity_versions av
       WHERE av.id = p_version_id
    ),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

REVOKE ALL ON FUNCTION public.activity_version_shares_with_family(UUID) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enforce_activity_submission_family_share_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_attempt public.activity_submission_attempts%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
       OR NEW.submission_id IS DISTINCT FROM OLD.submission_id THEN
      RAISE EXCEPTION 'family share attempt and submission are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT * INTO v_attempt
    FROM public.activity_submission_attempts
   WHERE id = NEW.attempt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'family share attempt % not found', NEW.attempt_id USING ERRCODE = '23503';
  END IF;

  IF v_attempt.submission_id IS DISTINCT FROM NEW.submission_id THEN
    RAISE EXCEPTION 'family share submission must match attempt submission' USING ERRCODE = '23514';
  END IF;

  IF v_attempt.status <> 'submitted' OR v_attempt.review_status <> 'approved' THEN
    RAISE EXCEPTION 'only approved submitted attempts can be family-share eligible' USING ERRCODE = '23514';
  END IF;

  NEW.family_comment := NULLIF(BTRIM(COALESCE(NEW.family_comment, '')), '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_activity_submission_family_share_integrity ON public.activity_submission_family_shares;
CREATE TRIGGER enforce_activity_submission_family_share_integrity
  BEFORE INSERT OR UPDATE ON public.activity_submission_family_shares
  FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_submission_family_share_integrity();

CREATE OR REPLACE FUNCTION public.enforce_activity_submission_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment public.assignments%ROWTYPE;
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_feedback TEXT;
  v_family_share_eligible BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.activity_id IS DISTINCT FROM OLD.activity_id
       OR NEW.version_id IS DISTINCT FROM OLD.version_id THEN
      RAISE EXCEPTION 'submission assignment, student, activity and version are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = NEW.assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission assignment % not found', NEW.assignment_id USING ERRCODE = '23503';
  END IF;

  IF v_assignment.activity_id IS DISTINCT FROM NEW.activity_id THEN
    RAISE EXCEPTION 'submission activity does not match assignment' USING ERRCODE = '23514';
  END IF;

  IF v_assignment.version_id IS DISTINCT FROM NEW.version_id THEN
    RAISE EXCEPTION 'submission version does not match assignment' USING ERRCODE = '23514';
  END IF;

  IF NOT public.student_can_access_assignment(NEW.student_id, NEW.assignment_id) THEN
    RAISE EXCEPTION 'student is not targeted by assignment' USING ERRCODE = '42501';
  END IF;

  IF NEW.latest_attempt_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.activity_submission_attempts attempt
     WHERE attempt.id = NEW.latest_attempt_id
       AND attempt.submission_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'latest attempt must belong to submission' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'submitted' AND NOT EXISTS (
    SELECT 1
      FROM public.activity_submission_attempts attempt
     WHERE attempt.id = NEW.latest_attempt_id
       AND attempt.submission_id = NEW.id
       AND attempt.status = 'submitted'
       AND attempt.attempt_number = NEW.latest_attempt_number
       AND attempt.response = NEW.latest_response
  ) THEN
    RAISE EXCEPTION 'submitted submission must reference its submitted latest attempt' USING ERRCODE = '23514';
  END IF;

  IF v_actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_actor_role = 'student' THEN
      IF v_actor_id IS DISTINCT FROM NEW.student_id OR NEW.status <> 'draft' THEN
        RAISE EXCEPTION 'students can only create their own draft submissions' USING ERRCODE = '42501';
      END IF;
      IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.teacher_feedback IS NOT NULL THEN
        RAISE EXCEPTION 'students cannot set review fields' USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;

    IF v_actor_role = 'teacher' THEN
      RAISE EXCEPTION 'teachers cannot create student submissions' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'student' THEN
    IF v_actor_id IS DISTINCT FROM NEW.student_id THEN
      RAISE EXCEPTION 'students can only update their own submissions' USING ERRCODE = '42501';
    END IF;

    IF OLD.status NOT IN ('draft', 'needs_revision') OR NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'invalid student submission transition' USING ERRCODE = '42501';
    END IF;

    NEW.reviewed_by = NULL;
    NEW.reviewed_at = NULL;
    NEW.teacher_feedback = NULL;

    IF NEW.status = 'submitted' THEN
      NEW.submitted_at = COALESCE(NEW.submitted_at, NOW());
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'teacher' THEN
    IF v_assignment.teacher_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'teachers can only review submissions for their assignments' USING ERRCODE = '42501';
    END IF;

    IF OLD.status <> 'submitted' OR NEW.status NOT IN ('needs_revision', 'approved') THEN
      RAISE EXCEPTION 'invalid teacher review transition' USING ERRCODE = '42501';
    END IF;

    IF NEW.latest_attempt_id IS DISTINCT FROM OLD.latest_attempt_id
       OR NEW.latest_attempt_number IS DISTINCT FROM OLD.latest_attempt_number
       OR NEW.latest_response IS DISTINCT FROM OLD.latest_response
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'teachers cannot change submitted response content' USING ERRCODE = '42501';
    END IF;

    v_feedback := NULLIF(BTRIM(COALESCE(NEW.teacher_feedback, '')), '');
    IF NEW.status = 'needs_revision' AND v_feedback IS NULL THEN
      RAISE EXCEPTION 'revision feedback is required' USING ERRCODE = '23514';
    END IF;

    v_family_share_eligible := NEW.status = 'approved'
      AND public.activity_version_shares_with_family(NEW.version_id);

    NEW.reviewed_by = v_actor_id;
    NEW.reviewed_at = NOW();
    NEW.teacher_feedback = CASE WHEN NEW.status = 'needs_revision' THEN v_feedback ELSE NULL END;

    UPDATE public.activity_submission_attempts
       SET review_status = NEW.status,
           reviewed_by = NEW.reviewed_by,
           reviewed_at = NEW.reviewed_at,
           teacher_feedback = NEW.teacher_feedback
     WHERE id = NEW.latest_attempt_id
       AND submission_id = NEW.id
       AND status = 'submitted';

    IF v_family_share_eligible THEN
      INSERT INTO public.activity_submission_family_shares (attempt_id, submission_id, family_comment)
      VALUES (NEW.latest_attempt_id, NEW.id, NULL)
      ON CONFLICT (attempt_id) DO UPDATE
      SET family_comment = public.activity_submission_family_shares.family_comment,
          updated_at = NOW();
    ELSE
      DELETE FROM public.activity_submission_family_shares
       WHERE attempt_id = NEW.latest_attempt_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.review_activity_submission(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.review_activity_submission(
  p_submission_id UUID,
  p_decision TEXT,
  p_teacher_feedback TEXT DEFAULT NULL,
  p_family_comment TEXT DEFAULT NULL
)
RETURNS public.activity_submissions AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_submission public.activity_submissions%ROWTYPE;
  v_attempt public.activity_submission_attempts%ROWTYPE;
  v_feedback TEXT := NULLIF(BTRIM(COALESCE(p_teacher_feedback, '')), '');
  v_family_comment TEXT := NULLIF(BTRIM(COALESCE(p_family_comment, '')), '');
  v_family_share_eligible BOOLEAN := FALSE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_role IS DISTINCT FROM 'teacher' THEN
    RAISE EXCEPTION 'only teachers can review activity submissions' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('needs_revision', 'approved') THEN
    RAISE EXCEPTION 'invalid review decision' USING ERRCODE = '23514';
  END IF;

  IF p_decision = 'needs_revision' AND v_feedback IS NULL THEN
    RAISE EXCEPTION 'revision feedback is required' USING ERRCODE = '23514';
  END IF;

  SELECT s.* INTO v_submission
    FROM public.activity_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
   WHERE s.id = p_submission_id
     AND a.teacher_id = v_actor_id
   FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission not found for this teacher' USING ERRCODE = '42501';
  END IF;

  IF v_submission.status <> 'submitted' THEN
    RAISE EXCEPTION 'only submitted work can be reviewed' USING ERRCODE = '23514';
  END IF;

  IF v_submission.latest_attempt_id IS NULL THEN
    RAISE EXCEPTION 'submitted work is missing its latest attempt' USING ERRCODE = '23514';
  END IF;

  v_family_share_eligible := p_decision = 'approved'
    AND public.activity_version_shares_with_family(v_submission.version_id);

  UPDATE public.activity_submission_attempts
     SET review_status = p_decision,
         reviewed_by = v_actor_id,
         reviewed_at = NOW(),
         teacher_feedback = CASE WHEN p_decision = 'needs_revision' THEN v_feedback ELSE NULL END
   WHERE id = v_submission.latest_attempt_id
     AND submission_id = v_submission.id
     AND status = 'submitted'
   RETURNING * INTO v_attempt;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'latest submitted attempt not found' USING ERRCODE = '23514';
  END IF;

  UPDATE public.activity_submissions
     SET status = p_decision,
         reviewed_by = v_actor_id,
         reviewed_at = v_attempt.reviewed_at,
         teacher_feedback = v_attempt.teacher_feedback
   WHERE id = v_submission.id
   RETURNING * INTO v_submission;

  IF v_family_share_eligible THEN
    INSERT INTO public.activity_submission_family_shares (attempt_id, submission_id, family_comment)
    VALUES (v_attempt.id, v_submission.id, v_family_comment)
    ON CONFLICT (attempt_id) DO UPDATE
    SET family_comment = EXCLUDED.family_comment,
        updated_at = NOW();
  ELSE
    DELETE FROM public.activity_submission_family_shares
     WHERE attempt_id = v_attempt.id;
  END IF;

  RETURN v_submission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.review_activity_submission(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_activity_submission(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

ALTER TABLE public.activity_submission_family_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers view family shares for own assignments" ON public.activity_submission_family_shares;
CREATE POLICY "Teachers view family shares for own assignments" ON public.activity_submission_family_shares
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM public.activity_submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
       WHERE s.id = submission_id
         AND a.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage activity submission family shares" ON public.activity_submission_family_shares;
CREATE POLICY "Admins manage activity submission family shares" ON public.activity_submission_family_shares
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT SELECT ON public.activity_submission_family_shares TO authenticated;
GRANT ALL ON public.activity_submission_family_shares TO service_role;

COMMENT ON TABLE public.activity_submission_family_shares IS
  'Private family-sharing metadata for approved free-response attempts. Row existence records approval-time family-share eligibility.';
COMMENT ON FUNCTION public.activity_version_shares_with_family(UUID) IS
  'Returns true when an immutable activity version opts approved work into future family sharing.';
COMMENT ON FUNCTION public.review_activity_submission(UUID, TEXT, TEXT, TEXT) IS
  'Applies an owning teacher review decision to the latest submitted free-response attempt, including approval-time family sharing metadata.';
COMMENT ON COLUMN public.activity_submission_family_shares.family_comment IS
  'Optional family-facing approval note. Separate from student-facing teacher_feedback and not readable by student RLS policies.';

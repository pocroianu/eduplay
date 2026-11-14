-- Teacher review queue lifecycle for free-response submissions.
-- Reviews are applied to the latest submitted attempt and mirrored onto the
-- aggregate activity_submissions row for fast queue reads.

ALTER TABLE public.activity_submission_attempts
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending', 'needs_revision', 'approved')),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;

CREATE INDEX IF NOT EXISTS idx_activity_submission_attempts_review_queue
  ON public.activity_submission_attempts(review_status, submitted_at DESC)
  WHERE status = 'submitted';

CREATE OR REPLACE FUNCTION public.enforce_activity_submission_attempt_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_submission public.activity_submissions%ROWTYPE;
  v_assignment public.assignments%ROWTYPE;
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
BEGIN
  IF v_actor_id IS NOT NULL THEN
    SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'submitted' THEN
      RAISE EXCEPTION 'submitted attempts are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  SELECT * INTO v_submission
    FROM public.activity_submissions
   WHERE id = NEW.submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'attempt submission % not found', NEW.submission_id USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = v_submission.assignment_id;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.submission_id IS DISTINCT FROM OLD.submission_id
       OR NEW.attempt_number IS DISTINCT FROM OLD.attempt_number THEN
      RAISE EXCEPTION 'attempt submission and number are immutable' USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'submitted' THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.response IS DISTINCT FROM OLD.response
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'submitted attempt response content is immutable' USING ERRCODE = '23514';
      END IF;

      IF v_actor_id IS NULL OR public.is_admin() THEN
        RETURN NEW;
      END IF;

      IF v_actor_role = 'teacher' AND v_assignment.teacher_id = v_actor_id THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'only the owning teacher can review submitted attempts' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_actor_id IS NULL OR public.is_admin() THEN
    IF NEW.status = 'submitted' THEN
      NEW.submitted_at = COALESCE(NEW.submitted_at, NOW());
      NEW.review_status = 'pending';
      NEW.reviewed_by = NULL;
      NEW.reviewed_at = NULL;
      NEW.teacher_feedback = NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF v_actor_role = 'student' THEN
    IF v_actor_id IS DISTINCT FROM v_submission.student_id THEN
      RAISE EXCEPTION 'students can only change their own attempts' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF NEW.status <> 'draft' OR v_submission.status NOT IN ('draft', 'needs_revision') THEN
        RAISE EXCEPTION 'students can only create draft attempts for editable submissions' USING ERRCODE = '42501';
      END IF;
      NEW.review_status = 'pending';
      NEW.reviewed_by = NULL;
      NEW.reviewed_at = NULL;
      NEW.teacher_feedback = NULL;
      RETURN NEW;
    END IF;

    IF v_submission.status NOT IN ('draft', 'needs_revision') THEN
      RAISE EXCEPTION 'attempts are editable only while the submission is editable' USING ERRCODE = '42501';
    END IF;

    IF NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'invalid attempt status' USING ERRCODE = '23514';
    END IF;

    IF NEW.review_status IS DISTINCT FROM OLD.review_status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.teacher_feedback IS DISTINCT FROM OLD.teacher_feedback THEN
      RAISE EXCEPTION 'students cannot set review fields' USING ERRCODE = '42501';
    END IF;

    IF NEW.status = 'submitted' THEN
      NEW.submitted_at = COALESCE(NEW.submitted_at, NOW());
      NEW.review_status = 'pending';
      NEW.reviewed_by = NULL;
      NEW.reviewed_at = NULL;
      NEW.teacher_feedback = NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'teacher' THEN
    RAISE EXCEPTION 'teachers cannot change student attempts directly' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.enforce_activity_submission_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment public.assignments%ROWTYPE;
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_feedback TEXT;
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

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.review_activity_submission(
  p_submission_id UUID,
  p_decision TEXT,
  p_teacher_feedback TEXT DEFAULT NULL
)
RETURNS public.activity_submissions AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_submission public.activity_submissions%ROWTYPE;
  v_attempt public.activity_submission_attempts%ROWTYPE;
  v_feedback TEXT := NULLIF(BTRIM(COALESCE(p_teacher_feedback, '')), '');
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

  RETURN v_submission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.review_activity_submission(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_activity_submission(UUID, TEXT, TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.review_activity_submission(UUID, TEXT, TEXT) IS
  'Applies an owning teacher review decision to the latest submitted free-response attempt and mirrors it onto the aggregate submission.';
COMMENT ON COLUMN public.activity_submission_attempts.review_status IS
  'Teacher review status for a submitted attempt. Draft attempts remain pending until submitted.';
COMMENT ON COLUMN public.activity_submission_attempts.teacher_feedback IS
  'Student-facing feedback captured when a teacher requests revision for this attempt.';

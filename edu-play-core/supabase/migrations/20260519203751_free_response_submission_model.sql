-- ============================================================================
-- Free-response submission model
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.activity_versions(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'needs_revision', 'approved')),
  latest_attempt_id UUID,
  latest_attempt_number INTEGER NOT NULL DEFAULT 0 CHECK (latest_attempt_number >= 0),
  latest_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  teacher_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.activity_submission_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.activity_submissions(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  response JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (submission_id, attempt_number)
);

ALTER TABLE public.activity_submissions
  DROP CONSTRAINT IF EXISTS activity_submissions_latest_attempt_id_fkey;

ALTER TABLE public.activity_submissions
  ADD CONSTRAINT activity_submissions_latest_attempt_id_fkey
  FOREIGN KEY (latest_attempt_id) REFERENCES public.activity_submission_attempts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_submissions_assignment_student
  ON public.activity_submissions(assignment_id, student_id);
CREATE INDEX IF NOT EXISTS idx_activity_submissions_student_status
  ON public.activity_submissions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_submissions_activity_version
  ON public.activity_submissions(activity_id, version_id);
CREATE INDEX IF NOT EXISTS idx_activity_submissions_review_queue
  ON public.activity_submissions(status, updated_at DESC)
  WHERE status IN ('submitted', 'needs_revision');
CREATE INDEX IF NOT EXISTS idx_activity_submission_attempts_submission
  ON public.activity_submission_attempts(submission_id, attempt_number DESC);

DROP TRIGGER IF EXISTS update_activity_submissions_updated_at ON public.activity_submissions;
CREATE TRIGGER update_activity_submissions_updated_at
  BEFORE UPDATE ON public.activity_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_activity_submission_attempts_updated_at ON public.activity_submission_attempts;
CREATE TRIGGER update_activity_submission_attempts_updated_at
  BEFORE UPDATE ON public.activity_submission_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.student_can_access_assignment(
  p_student_id UUID,
  p_assignment_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.assignments a
      JOIN public.students s ON s.id = p_student_id
     WHERE a.id = p_assignment_id
       AND (
         a.student_id = p_student_id
         OR (a.class_id IS NOT NULL AND s.class_id = a.class_id)
       )
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

REVOKE ALL ON FUNCTION public.student_can_access_assignment(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_can_access_assignment(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.teacher_can_review_submission(
  p_teacher_id UUID,
  p_submission_id UUID
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.activity_submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      JOIN public.profiles p ON p.id = p_teacher_id
     WHERE s.id = p_submission_id
       AND a.teacher_id = p_teacher_id
       AND p.role = 'teacher'
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

REVOKE ALL ON FUNCTION public.teacher_can_review_submission(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.teacher_can_review_submission(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_activity_submission_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment public.assignments%ROWTYPE;
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
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

    NEW.reviewed_by = v_actor_id;
    NEW.reviewed_at = NOW();
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_activity_submission_integrity ON public.activity_submissions;
CREATE TRIGGER enforce_activity_submission_integrity
  BEFORE INSERT OR UPDATE ON public.activity_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_submission_integrity();

CREATE OR REPLACE FUNCTION public.enforce_activity_submission_attempt_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_submission public.activity_submissions%ROWTYPE;
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
BEGIN
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

  IF TG_OP = 'UPDATE' THEN
    IF NEW.submission_id IS DISTINCT FROM OLD.submission_id
       OR NEW.attempt_number IS DISTINCT FROM OLD.attempt_number THEN
      RAISE EXCEPTION 'attempt submission and number are immutable' USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'submitted' THEN
      RAISE EXCEPTION 'submitted attempts are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_actor_id IS NULL OR public.is_admin() THEN
    IF NEW.status = 'submitted' THEN
      NEW.submitted_at = COALESCE(NEW.submitted_at, NOW());
    END IF;
    RETURN NEW;
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;

  IF v_actor_role = 'student' THEN
    IF v_actor_id IS DISTINCT FROM v_submission.student_id THEN
      RAISE EXCEPTION 'students can only change their own attempts' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF NEW.status <> 'draft' OR v_submission.status NOT IN ('draft', 'needs_revision') THEN
        RAISE EXCEPTION 'students can only create draft attempts for editable submissions' USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;

    IF v_submission.status NOT IN ('draft', 'needs_revision') THEN
      RAISE EXCEPTION 'attempts are editable only while the submission is editable' USING ERRCODE = '42501';
    END IF;

    IF NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'invalid attempt status' USING ERRCODE = '23514';
    END IF;

    IF NEW.status = 'submitted' THEN
      NEW.submitted_at = COALESCE(NEW.submitted_at, NOW());
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'teacher' THEN
    RAISE EXCEPTION 'teachers cannot change student attempts' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_activity_submission_attempt_integrity ON public.activity_submission_attempts;
CREATE TRIGGER enforce_activity_submission_attempt_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON public.activity_submission_attempts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_submission_attempt_integrity();

ALTER TABLE public.activity_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_submission_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own activity submissions" ON public.activity_submissions;
CREATE POLICY "Students can view own activity submissions" ON public.activity_submissions
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own assigned activity submissions" ON public.activity_submissions;
DROP POLICY IF EXISTS "Students can update own editable activity submissions" ON public.activity_submissions;
DROP POLICY IF EXISTS "Teachers can view submissions for own assignments" ON public.activity_submissions;
CREATE POLICY "Teachers can view submissions for own assignments" ON public.activity_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
       WHERE a.id = assignment_id
         AND a.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can review submissions for own assignments" ON public.activity_submissions;
CREATE POLICY "Teachers can review submissions for own assignments" ON public.activity_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
       WHERE a.id = assignment_id
         AND a.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
       WHERE a.id = assignment_id
         AND a.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Parents can view child approved activity submissions" ON public.activity_submissions;
DROP POLICY IF EXISTS "Admins can manage activity submissions" ON public.activity_submissions;
CREATE POLICY "Admins can manage activity submissions" ON public.activity_submissions
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Students can view own activity submission attempts" ON public.activity_submission_attempts;
CREATE POLICY "Students can view own activity submission attempts" ON public.activity_submission_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.activity_submissions s
       WHERE s.id = submission_id
         AND s.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can insert own draft activity submission attempts" ON public.activity_submission_attempts;
DROP POLICY IF EXISTS "Students can update own draft activity submission attempts" ON public.activity_submission_attempts;
DROP POLICY IF EXISTS "Teachers can view attempts for own assignments" ON public.activity_submission_attempts;
CREATE POLICY "Teachers can view attempts for own assignments" ON public.activity_submission_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM public.activity_submissions s
        JOIN public.assignments a ON a.id = s.assignment_id
       WHERE s.id = submission_id
         AND a.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage activity submission attempts" ON public.activity_submission_attempts;
CREATE POLICY "Admins can manage activity submission attempts" ON public.activity_submission_attempts
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.record_activity_submission(
  p_assignment_id UUID,
  p_activity_id UUID,
  p_version_id UUID,
  p_intent TEXT DEFAULT 'start',
  p_response JSONB DEFAULT '{}'::jsonb
)
RETURNS public.activity_submissions AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_assignment public.assignments%ROWTYPE;
  v_submission public.activity_submissions%ROWTYPE;
  v_attempt public.activity_submission_attempts%ROWTYPE;
  v_response JSONB := COALESCE(p_response, '{}'::jsonb);
  v_progress_status TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'only students can record activity submissions' USING ERRCODE = '42501';
  END IF;

  IF p_intent NOT IN ('start', 'submit') THEN
    RAISE EXCEPTION 'invalid submission intent' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment not found' USING ERRCODE = '23503';
  END IF;

  IF v_assignment.activity_id IS DISTINCT FROM p_activity_id THEN
    RAISE EXCEPTION 'assignment does not target this activity' USING ERRCODE = '23514';
  END IF;

  IF v_assignment.version_id IS DISTINCT FROM p_version_id THEN
    RAISE EXCEPTION 'assignment does not target this activity version' USING ERRCODE = '23514';
  END IF;

  IF NOT public.student_can_access_assignment(v_actor_id, p_assignment_id) THEN
    RAISE EXCEPTION 'student is not targeted by assignment' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_submission
    FROM public.activity_submissions
   WHERE assignment_id = p_assignment_id
     AND student_id = v_actor_id
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.activity_submissions (
      assignment_id,
      student_id,
      activity_id,
      version_id,
      latest_response
    ) VALUES (
      p_assignment_id,
      v_actor_id,
      p_activity_id,
      p_version_id,
      v_response
    )
    RETURNING * INTO v_submission;
  END IF;

  IF p_intent = 'start' THEN
    IF v_submission.status NOT IN ('draft', 'needs_revision') THEN
      RETURN v_submission;
    END IF;

    SELECT * INTO v_attempt
      FROM public.activity_submission_attempts
     WHERE submission_id = v_submission.id
       AND status = 'draft'
     ORDER BY attempt_number DESC
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
      IF v_submission.status = 'needs_revision' THEN
        v_response := v_submission.latest_response;
      END IF;

      INSERT INTO public.activity_submission_attempts (
        submission_id,
        attempt_number,
        response
      ) VALUES (
        v_submission.id,
        v_submission.latest_attempt_number + 1,
        v_response
      )
      RETURNING * INTO v_attempt;
    ELSE
      UPDATE public.activity_submission_attempts
         SET response = v_response
       WHERE id = v_attempt.id
       RETURNING * INTO v_attempt;
    END IF;

    UPDATE public.activity_submissions
       SET status = 'draft',
           latest_response = v_attempt.response,
           reviewed_by = NULL,
           reviewed_at = NULL,
           teacher_feedback = NULL
     WHERE id = v_submission.id
     RETURNING * INTO v_submission;

    v_progress_status := 'in_progress';
  ELSE
    IF v_submission.status = 'approved' THEN
      RAISE EXCEPTION 'submission already approved' USING ERRCODE = '23514';
    END IF;

    IF v_submission.status = 'submitted' THEN
      RAISE EXCEPTION 'submission already awaiting review' USING ERRCODE = '23505';
    END IF;

    SELECT * INTO v_attempt
      FROM public.activity_submission_attempts
     WHERE submission_id = v_submission.id
       AND status = 'draft'
     ORDER BY attempt_number DESC
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.activity_submission_attempts (
        submission_id,
        attempt_number,
        response
      ) VALUES (
        v_submission.id,
        v_submission.latest_attempt_number + 1,
        v_response
      )
      RETURNING * INTO v_attempt;
    ELSE
      UPDATE public.activity_submission_attempts
         SET response = v_response
       WHERE id = v_attempt.id
       RETURNING * INTO v_attempt;
    END IF;

    UPDATE public.activity_submission_attempts
       SET status = 'submitted', response = v_response
     WHERE id = v_attempt.id
     RETURNING * INTO v_attempt;

    UPDATE public.activity_submissions
       SET status = 'submitted',
           latest_attempt_id = v_attempt.id,
           latest_attempt_number = v_attempt.attempt_number,
           latest_response = v_attempt.response,
           reviewed_by = NULL,
           reviewed_at = NULL,
           teacher_feedback = NULL
     WHERE id = v_submission.id
     RETURNING * INTO v_submission;

    v_progress_status := 'completed';
  END IF;

  INSERT INTO public.activity_progress (
    student_id,
    activity_id,
    last_version_id,
    status,
    attempts,
    last_played_at,
    completed_at
  ) VALUES (
    v_actor_id,
    p_activity_id,
    p_version_id,
    v_progress_status,
    CASE WHEN v_progress_status = 'completed' THEN v_submission.latest_attempt_number ELSE 0 END,
    NOW(),
    CASE WHEN v_progress_status = 'completed' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (student_id, activity_id) DO UPDATE
  SET last_version_id = EXCLUDED.last_version_id,
      status = EXCLUDED.status,
      attempts = GREATEST(COALESCE(public.activity_progress.attempts, 0), EXCLUDED.attempts),
      last_played_at = EXCLUDED.last_played_at,
      completed_at = COALESCE(public.activity_progress.completed_at, EXCLUDED.completed_at),
      updated_at = NOW();

  RETURN v_submission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.record_activity_submission(UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_activity_submission(UUID, UUID, UUID, TEXT, JSONB) TO authenticated, service_role;

GRANT SELECT, UPDATE, DELETE ON public.activity_submissions TO authenticated;
GRANT SELECT, DELETE ON public.activity_submission_attempts TO authenticated;
GRANT ALL ON public.activity_submissions TO service_role;
GRANT ALL ON public.activity_submission_attempts TO service_role;

DROP TRIGGER IF EXISTS audit_activity_submissions ON public.activity_submissions;
CREATE TRIGGER audit_activity_submissions
  AFTER INSERT OR UPDATE OR DELETE ON public.activity_submissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

DROP TRIGGER IF EXISTS audit_activity_submission_attempts ON public.activity_submission_attempts;
CREATE TRIGGER audit_activity_submission_attempts
  AFTER INSERT OR UPDATE OR DELETE ON public.activity_submission_attempts
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

COMMENT ON TABLE public.activity_submissions IS
  'Current aggregate submission state for a student assignment. One row per student and assignment; attempts preserve history.';
COMMENT ON TABLE public.activity_submission_attempts IS
  'Immutable-on-submit free-response attempt history. Draft attempts can be edited until submitted.';
COMMENT ON COLUMN public.activity_submissions.latest_response IS
  'Latest aggregate response payload, copied from the latest submitted/draft attempt for fast review and resume.';

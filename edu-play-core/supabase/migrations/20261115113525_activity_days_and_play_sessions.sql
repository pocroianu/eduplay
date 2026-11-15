-- Saved learner engagement, independent of the latest per-Activity summary.
CREATE TABLE public.activity_days (
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  active_day DATE NOT NULL,
  PRIMARY KEY (student_id, active_day)
);
ALTER TABLE public.activity_days ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_days FROM anon, authenticated, directus_admin;
GRANT SELECT ON public.activity_days TO authenticated;
CREATE POLICY activity_days_read ON public.activity_days FOR SELECT TO authenticated
  USING (
    student_id = (SELECT auth.uid())
    OR student_id IN (SELECT public.get_teacher_student_ids((SELECT auth.uid())))
    OR student_id IN (SELECT public.get_parent_student_ids((SELECT auth.uid())))
    OR (SELECT public.is_admin())
  );
COMMENT ON TABLE public.activity_days IS
  'Observed saved learner engagement in Europe/Bucharest. Historical coverage before this migration may be incomplete.';

CREATE FUNCTION public.capture_activity_day() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Teacher adjustments and demo fixtures are not learner engagement.
  IF auth.uid() = NEW.student_id AND NEW.status <> 'not_started' THEN
    INSERT INTO public.activity_days(student_id, active_day)
      VALUES (NEW.student_id, (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_activity_day() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER capture_activity_day AFTER INSERT OR UPDATE ON public.activity_progress
  FOR EACH ROW EXECUTE FUNCTION public.capture_activity_day();

-- Only recover dates supported by an authenticated learner's recorded write.
-- Do not infer missing days from aggregate attempts or an unrelated audit edit.
INSERT INTO public.activity_days(student_id, active_day)
SELECT DISTINCT p.student_id, (a.changed_at AT TIME ZONE 'Europe/Bucharest')::date
FROM public.audit_logs a
JOIN public.activity_progress p ON p.id = a.record_id
WHERE a.table_name = 'activity_progress'
  AND a.operation IN ('INSERT', 'UPDATE')
  AND a.changed_by = p.student_id
  AND a.new_data->>'status' IN ('in_progress', 'completed')
  AND a.new_data->>'last_played_at' IS NOT NULL
  AND (a.operation = 'INSERT' OR a.new_data->>'last_played_at' IS DISTINCT FROM a.old_data->>'last_played_at')
ON CONFLICT DO NOTHING;

-- Cumulative elapsed time and sequence numbers make ambiguous HTTP retries safe.
CREATE TABLE public.activity_play_sessions (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.activity_versions(id) ON DELETE SET NULL,
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  elapsed_seconds INTEGER NOT NULL DEFAULT 0 CHECK (elapsed_seconds >= 0),
  completed BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX activity_play_sessions_student_activity ON public.activity_play_sessions(student_id, activity_id);
CREATE INDEX activity_play_sessions_activity ON public.activity_play_sessions(activity_id);
CREATE INDEX activity_play_sessions_version ON public.activity_play_sessions(version_id);
ALTER TABLE public.activity_play_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_play_sessions FROM anon, authenticated, directus_admin;
GRANT SELECT ON public.activity_play_sessions TO authenticated;
CREATE POLICY activity_play_sessions_read ON public.activity_play_sessions FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE FUNCTION public.record_activity_play_session(
  p_student_id UUID, p_activity_id UUID,
  p_session_id UUID, p_sequence INTEGER, p_elapsed_seconds INTEGER,
  p_status TEXT, p_version_id UUID DEFAULT NULL, p_score INTEGER DEFAULT NULL, p_data JSONB DEFAULT NULL
) RETURNS public.activity_progress
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_role TEXT;
  v_session public.activity_play_sessions;
  v_progress public.activity_progress;
  v_delta INTEGER;
  v_first BOOLEAN;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = v_actor;
  IF v_actor IS NULL OR NOT (
    (v_role = 'student' AND v_actor = p_student_id)
    OR (v_role = 'teacher' AND p_student_id IN (SELECT public.get_teacher_student_ids(v_actor)))
  ) THEN
    RAISE EXCEPTION 'Not permitted to record learner progress' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL OR p_sequence IS NULL OR p_sequence < 1
    OR p_elapsed_seconds IS NULL OR p_elapsed_seconds < 0
    OR p_status IS NULL OR p_status NOT IN ('in_progress', 'completed')
    OR p_score < 0 THEN
    RAISE EXCEPTION 'Invalid play session progress' USING ERRCODE = '22023';
  END IF;
  IF p_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.activity_versions WHERE id = p_version_id AND activity_id = p_activity_id
  ) THEN
    RAISE EXCEPTION 'Version does not belong to Activity' USING ERRCODE = '22023';
  END IF;

  -- Serialize both the session cursor and the aggregate across concurrent tabs.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_activity_id::text, 0));
  INSERT INTO public.activity_play_sessions(id, student_id, activity_id, version_id)
    VALUES (p_session_id, p_student_id, p_activity_id, p_version_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_session FROM public.activity_play_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.student_id <> p_student_id OR v_session.activity_id <> p_activity_id
    OR v_session.version_id IS DISTINCT FROM p_version_id THEN
    RAISE EXCEPTION 'Play session context mismatch' USING ERRCODE = '22023';
  END IF;
  IF p_sequence <= v_session.sequence OR v_session.completed THEN
    SELECT * INTO v_progress FROM public.activity_progress
      WHERE student_id = p_student_id AND activity_id = p_activity_id;
    RETURN v_progress;
  END IF;
  v_first := v_session.sequence = 0;
  v_delta := greatest(0, p_elapsed_seconds - v_session.elapsed_seconds);
  UPDATE public.activity_play_sessions SET sequence = p_sequence,
    elapsed_seconds = greatest(elapsed_seconds, p_elapsed_seconds), completed = p_status = 'completed'
    WHERE id = p_session_id;

  INSERT INTO public.activity_progress AS current_progress (
    student_id, activity_id, last_version_id, status, score, attempts, time_spent,
    last_played_at, completed_at, data
  ) VALUES (
    p_student_id, p_activity_id, p_version_id, p_status, p_score, 1, v_delta,
    statement_timestamp(), CASE WHEN p_status = 'completed' THEN statement_timestamp() END, p_data
  ) ON CONFLICT (student_id, activity_id) DO UPDATE SET
    last_version_id = coalesce(EXCLUDED.last_version_id, current_progress.last_version_id),
    status = CASE WHEN current_progress.status = 'completed' THEN 'completed' ELSE EXCLUDED.status END,
    score = CASE WHEN current_progress.status = 'completed' AND p_status <> 'completed'
      THEN current_progress.score ELSE coalesce(EXCLUDED.score, current_progress.score) END,
    attempts = coalesce(current_progress.attempts, 0) + CASE WHEN v_first THEN 1 ELSE 0 END,
    time_spent = coalesce(current_progress.time_spent, 0) + v_delta,
    last_played_at = statement_timestamp(),
    completed_at = coalesce(EXCLUDED.completed_at, current_progress.completed_at),
    data = CASE WHEN current_progress.status = 'completed' AND p_status <> 'completed'
      THEN current_progress.data ELSE coalesce(EXCLUDED.data, current_progress.data) END
  RETURNING * INTO v_progress;
  RETURN v_progress;
END;
$$;
REVOKE ALL ON FUNCTION public.record_activity_play_session(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, UUID, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_activity_play_session(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, UUID, INTEGER, JSONB) TO authenticated;

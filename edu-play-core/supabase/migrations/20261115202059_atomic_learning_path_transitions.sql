-- Both transitions serialize by learner/path, including the first write when
-- there is no progress row to lock. Existing rows are also locked so direct
-- teacher writes cannot interleave with an advancement's guard and mutation.
CREATE OR REPLACE FUNCTION public.advance_learning_path_progress(
  p_student_id uuid, p_path_id uuid, p_completed_step_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_step public.learning_path_steps%ROWTYPE;
  v_progress public.student_path_progress%ROWTYPE;
  v_next_id uuid;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Trusted server access required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('path-progress/' || p_student_id::text || '/' || p_path_id::text, 0));
  IF NOT EXISTS (
    SELECT 1 FROM learning_path_assignments a JOIN students s ON s.id = p_student_id
    WHERE a.path_id = p_path_id AND (a.student_id = s.id OR a.class_id = s.class_id)
  ) THEN
    RAISE EXCEPTION 'Learning Path is not assigned' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_step FROM learning_path_steps
    WHERE id = p_completed_step_id AND path_id = p_path_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completed step does not belong to Learning Path' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_progress FROM student_path_progress
    WHERE student_id = p_student_id AND path_id = p_path_id FOR UPDATE;
  IF v_progress.last_completed_step_id = p_completed_step_id
    OR v_progress.status IN ('completed', 'overridden')
    OR (v_progress.current_step_id IS NOT NULL AND v_progress.current_step_id <> p_completed_step_id)
  THEN RETURN; END IF;
  IF v_progress.current_step_id IS NULL AND EXISTS (
    SELECT 1 FROM learning_path_steps WHERE path_id = p_path_id AND step_order < v_step.step_order
  ) THEN RETURN; END IF;
  SELECT id INTO v_next_id FROM learning_path_steps
    WHERE path_id = p_path_id AND step_order > v_step.step_order ORDER BY step_order LIMIT 1;
  INSERT INTO student_path_progress (
    student_id, path_id, current_step_id, last_completed_step_id, status, started_at, completed_at
  ) VALUES (
    p_student_id, p_path_id, v_next_id, p_completed_step_id,
    CASE WHEN v_next_id IS NULL THEN 'completed' ELSE 'in_progress' END,
    coalesce(v_progress.started_at, now()),
    CASE WHEN v_next_id IS NULL THEN coalesce(v_progress.completed_at, now()) ELSE NULL END
  ) ON CONFLICT (student_id, path_id) DO UPDATE SET
    current_step_id = EXCLUDED.current_step_id,
    last_completed_step_id = EXCLUDED.last_completed_step_id,
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    completed_at = EXCLUDED.completed_at;
END;
$$;
REVOKE ALL ON FUNCTION public.advance_learning_path_progress(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_learning_path_progress(uuid, uuid, uuid) TO service_role;
COMMENT ON FUNCTION public.advance_learning_path_progress(uuid, uuid, uuid) IS
  'Trusted server completion transition. Call only after scoped Activity completion matching; students cannot invoke it directly.';

CREATE OR REPLACE FUNCTION public.override_learning_path_progress(
  p_student_id uuid, p_path_id uuid, p_status text, p_current_step_id uuid DEFAULT NULL
) RETURNS SETOF public.student_path_progress
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('teacher', 'admin') THEN
    RAISE EXCEPTION 'Teacher access required' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('completed', 'overridden', 'in_progress') THEN
    RAISE EXCEPTION 'Invalid progress status' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM students s WHERE s.id = p_student_id
    AND (v_role = 'admin' OR s.id IN (SELECT get_teacher_student_ids(auth.uid())))) THEN
    RAISE EXCEPTION 'Student is outside teacher roster' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('path-progress/' || p_student_id::text || '/' || p_path_id::text, 0));
  IF NOT EXISTS (
    SELECT 1 FROM learning_path_assignments a JOIN students s ON s.id = p_student_id
    WHERE a.path_id = p_path_id AND (a.student_id = s.id OR a.class_id = s.class_id)
  ) THEN
    RAISE EXCEPTION 'Learning Path is not assigned' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY INSERT INTO student_path_progress (
    student_id, path_id, status, current_step_id, completed_at
  ) VALUES (
    p_student_id, p_path_id, p_status, p_current_step_id,
    CASE WHEN p_status = 'completed' THEN now() ELSE NULL END
  ) ON CONFLICT (student_id, path_id) DO UPDATE SET
    status = EXCLUDED.status,
    current_step_id = EXCLUDED.current_step_id,
    last_completed_step_id = CASE WHEN p_status = 'completed' THEN student_path_progress.last_completed_step_id ELSE NULL END,
    completed_at = EXCLUDED.completed_at
  RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION public.override_learning_path_progress(uuid, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.override_learning_path_progress(uuid, uuid, text, uuid) TO authenticated;
COMMENT ON FUNCTION public.override_learning_path_progress(uuid, uuid, text, uuid) IS
  'Teacher override with explicit role, roster and Assignment checks (including admins whose student reads are hidden by RLS); serializes with advancement and supports reopening.';

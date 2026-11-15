-- One receipt per deliberate submission, not per reusable Activity instance.
CREATE TABLE public.native_activity_submissions (
  id uuid PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.activity_instances(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  artifact_id uuid NOT NULL REFERENCES public.child_artifacts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX native_activity_submissions_instance_idx ON public.native_activity_submissions(instance_id, created_at);
CREATE INDEX native_activity_submissions_student_idx ON public.native_activity_submissions(student_id);
CREATE INDEX native_activity_submissions_artifact_idx ON public.native_activity_submissions(artifact_id);
CREATE TABLE public.native_activity_submission_targets (
  submission_id uuid NOT NULL REFERENCES public.native_activity_submissions(id) ON DELETE CASCADE,
  step_id uuid NOT NULL REFERENCES public.learning_path_steps(id) ON DELETE CASCADE,
  settled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (submission_id, step_id)
);
CREATE INDEX native_activity_submission_targets_step_idx ON public.native_activity_submission_targets(step_id);
ALTER TABLE public.native_activity_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.native_activity_submission_targets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.native_activity_submissions, public.native_activity_submission_targets FROM anon, authenticated;
GRANT SELECT ON public.native_activity_submissions, public.native_activity_submission_targets TO authenticated;
GRANT ALL ON public.native_activity_submissions, public.native_activity_submission_targets TO service_role;
CREATE POLICY own_native_submissions ON public.native_activity_submissions FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()));
CREATE POLICY own_native_submission_targets ON public.native_activity_submission_targets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.native_activity_submissions s WHERE s.id = submission_id AND s.student_id = (SELECT auth.uid())));

-- Trusted server only: the server validates actual media bytes before upload.
CREATE FUNCTION public.accept_native_activity_submission(
  p_student_id uuid, p_instance_id uuid, p_submission_id uuid, p_type_id text,
  p_storage_path text, p_duration_ms integer DEFAULT NULL
) RETURNS public.native_activity_submissions
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_instance activity_instances%ROWTYPE;
  v_student students%ROWTYPE;
  v_receipt native_activity_submissions%ROWTYPE;
  v_path uuid;
  v_artifact uuid := gen_random_uuid();
  v_claims text := coalesce(current_setting('request.jwt.claims',true),'');
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Trusted server access required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_instance FROM activity_instances WHERE id=p_instance_id FOR UPDATE;
  IF NOT FOUND OR v_instance.assigned_to <> p_student_id OR v_instance.type_id <> p_type_id
    OR p_type_id NOT IN ('drawing-canvas','voice-recording')
    OR NOT EXISTS (SELECT 1 FROM profiles WHERE id=p_student_id AND role='student')
  THEN RAISE EXCEPTION 'Activity is not available' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_receipt FROM native_activity_submissions WHERE id=p_submission_id;
  IF FOUND THEN
    IF v_receipt.student_id <> p_student_id OR v_receipt.instance_id <> p_instance_id THEN
      RAISE EXCEPTION 'Submission identity mismatch' USING ERRCODE='42501';
    END IF;
    RETURN v_receipt;
  END IF;
  SELECT * INTO v_student FROM students WHERE id=p_student_id FOR SHARE;
  IF p_type_id='voice-recording' AND coalesce((v_student.consents->>'audio_recording')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Audio consent required' USING ERRCODE='42501';
  END IF;
  IF p_storage_path IS NULL OR p_storage_path !~ ('^' || p_student_id::text || '/[0-9a-f-]{36}\.(png|webm|ogg)$')
    OR (p_type_id='drawing-canvas' AND p_storage_path NOT LIKE '%.png')
    OR (p_type_id='voice-recording' AND p_storage_path NOT SIMILAR TO '%\.(webm|ogg)')
    OR (p_duration_ms IS NOT NULL AND p_duration_ms < 0)
  THEN RAISE EXCEPTION 'Invalid uploaded media' USING ERRCODE='23514'; END IF;

  -- Lock paths in a stable order, using the same lock as advancement/override.
  FOR v_path IN SELECT DISTINCT a.path_id FROM learning_path_assignments a
    WHERE a.student_id=p_student_id OR a.class_id=v_student.class_id ORDER BY a.path_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('path-progress/' || p_student_id::text || '/' || v_path::text,0));
  END LOOP;
  -- The privileged adapter has no learner JWT. Preserve audit attribution to
  -- the learner already verified above, then restore the caller's claims.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',p_student_id,'role','service_role')::text,true);
  INSERT INTO child_artifacts(id,student_id,class_id,artifact_type,storage_path,visibility,metadata)
    VALUES (v_artifact,p_student_id,v_student.class_id,
      CASE WHEN p_type_id='drawing-canvas' THEN 'drawing' ELSE 'audio' END,
      p_storage_path,'draft',jsonb_build_object('sourceRef',p_instance_id,'activityInstanceId',p_instance_id,
        'activityTypeId',p_type_id,'durationMs',p_duration_ms,
        'activityTitle',CASE WHEN p_type_id='drawing-canvas' THEN 'Desen liber' ELSE 'Înregistrare vocală' END));
  INSERT INTO native_activity_submissions(id,instance_id,student_id,artifact_id)
    VALUES(p_submission_id,p_instance_id,p_student_id,v_artifact) RETURNING * INTO v_receipt;
  INSERT INTO native_activity_submission_targets(submission_id,step_id)
    SELECT p_submission_id,s.id FROM learning_path_steps s
    LEFT JOIN student_path_progress p ON p.path_id=s.path_id AND p.student_id=p_student_id
    WHERE s.target_activity_type=p_type_id AND s.target_activity_config=v_instance.config
      AND EXISTS (SELECT 1 FROM learning_path_assignments a WHERE a.path_id=s.path_id
        AND (a.student_id=p_student_id OR a.class_id=v_student.class_id))
      AND (p.status IS NULL OR p.status='in_progress')
      AND (p.current_step_id=s.id OR (p.current_step_id IS NULL AND p.status IS NULL AND NOT EXISTS
        (SELECT 1 FROM learning_path_steps earlier WHERE earlier.path_id=s.path_id AND earlier.step_order<s.step_order)));
  UPDATE activity_instances SET result_summary=jsonb_build_object('status','completed','artifactId',v_artifact,
    'submissionId',p_submission_id,'durationMs',p_duration_ms) WHERE id=p_instance_id;
  PERFORM set_config('request.jwt.claims',v_claims,true);
  RETURN v_receipt;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_native_activity_submission(uuid,uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_native_activity_submission(uuid,uuid,uuid,text,text,integer) TO service_role;

CREATE FUNCTION public.retry_native_activity_progress(p_student_id uuid,p_submission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_receipt native_activity_submissions%ROWTYPE; v_target record;
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Trusted server access required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_receipt FROM native_activity_submissions WHERE id=p_submission_id AND student_id=p_student_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission is not available' USING ERRCODE='42501'; END IF;
  -- A settled target never replays, including after teacher reopening.
  FOR v_target IN SELECT t.step_id,s.path_id FROM native_activity_submission_targets t
    JOIN learning_path_steps s ON s.id=t.step_id WHERE t.submission_id=p_submission_id AND NOT t.settled
    ORDER BY s.path_id,s.id FOR UPDATE OF t
  LOOP
    -- An assignment removed since acceptance must not prevent other recovery.
    IF EXISTS (SELECT 1 FROM learning_path_assignments a JOIN students st ON st.id=p_student_id
      WHERE a.path_id=v_target.path_id AND (a.student_id=p_student_id OR a.class_id=st.class_id)) THEN
      PERFORM advance_learning_path_progress(p_student_id,v_target.path_id,v_target.step_id);
    END IF;
    UPDATE native_activity_submission_targets SET settled=true WHERE submission_id=p_submission_id AND step_id=v_target.step_id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.retry_native_activity_progress(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.retry_native_activity_progress(uuid,uuid) TO service_role;

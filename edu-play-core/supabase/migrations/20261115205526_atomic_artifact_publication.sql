-- Transition result is computed under one row lock, including same-state retries.
CREATE FUNCTION public.change_artifact_visibility(p_artifact_id uuid, p_visibility text)
RETURNS TABLE(artifact jsonb, became_family_visible boolean)
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_prior public.child_artifacts; v_row public.child_artifacts;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('teacher','admin')) THEN
    RAISE EXCEPTION 'artifact_visibility_forbidden' USING ERRCODE='42501';
  END IF;
  IF p_visibility IS NULL OR p_visibility NOT IN ('draft','family_visible','internal_teacher_only','archived') THEN
    RAISE EXCEPTION 'artifact_visibility_invalid' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_prior FROM public.child_artifacts WHERE id=p_artifact_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_prior.visibility::text = p_visibility THEN
    RETURN QUERY SELECT to_jsonb(v_prior), false;
    RETURN;
  END IF;
  UPDATE public.child_artifacts SET
    visibility=p_visibility::public.visibility_status,
    reviewed_by=CASE WHEN p_visibility <> 'draft' THEN auth.uid() ELSE reviewed_by END,
    reviewed_at=CASE WHEN p_visibility <> 'draft' THEN now() ELSE reviewed_at END
  WHERE id=p_artifact_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT to_jsonb(v_row), p_visibility='family_visible';
END;
$$;
REVOKE ALL ON FUNCTION public.change_artifact_visibility(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_artifact_visibility(uuid,text) TO authenticated;

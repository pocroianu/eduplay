-- Duplicate/archive lifecycle actions for teacher-owned private Activities.
-- Duplicates copy the editable Activity draft config and live resources only; they
-- intentionally do not copy ready version history, assignments, submissions, or
-- family-share rows.

CREATE OR REPLACE FUNCTION public.duplicate_teacher_activity_atomically(
  p_activity_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source public.activities%ROWTYPE;
  v_duplicate public.activities%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.id = p_actor_id
       AND p.role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'actor is not a teacher' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_source
    FROM public.activities
   WHERE id = p_activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity % not found', p_activity_id USING ERRCODE = 'P0002';
  END IF;

  IF v_source.created_by IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'teacher does not own activity %', p_activity_id USING ERRCODE = '42501';
  END IF;

  IF v_source.visibility_scope IS DISTINCT FROM 'private' THEN
    RAISE EXCEPTION 'teachers can only duplicate private owned activities' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.activities (
    template,
    title,
    description,
    thumbnail_url,
    default_lang,
    default_theme,
    category,
    difficulty,
    target_age_min,
    target_age_max,
    estimated_duration,
    question_count,
    tags,
    subject,
    skills,
    is_published,
    created_by,
    config_data,
    config_schema_version,
    status,
    visibility_scope
  )
  VALUES (
    v_source.template,
    v_source.title || ' (copie)',
    v_source.description,
    v_source.thumbnail_url,
    v_source.default_lang,
    v_source.default_theme,
    v_source.category,
    v_source.difficulty,
    v_source.target_age_min,
    v_source.target_age_max,
    v_source.estimated_duration,
    v_source.question_count,
    v_source.tags,
    v_source.subject,
    v_source.skills,
    FALSE,
    p_actor_id,
    v_source.config_data,
    v_source.config_schema_version,
    'draft',
    'private'
  )
  RETURNING * INTO v_duplicate;

  INSERT INTO public.activity_resources (
    activity_id,
    version_id,
    resource_type,
    title,
    url,
    sort_order,
    created_by
  )
  SELECT v_duplicate.id,
         NULL,
         resource_type,
         title,
         url,
         sort_order,
         p_actor_id
    FROM public.activity_resources
   WHERE activity_id = p_activity_id
     AND version_id IS NULL
   ORDER BY sort_order;

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    operation,
    action,
    visibility,
    old_data,
    new_data,
    changed_by
  )
  VALUES (
    'activities',
    v_duplicate.id,
    'INSERT',
    'teacher_activity_duplicate',
    'tenant',
    jsonb_build_object('sourceActivityId', p_activity_id),
    jsonb_build_object(
      'status', v_duplicate.status,
      'isPublished', COALESCE(v_duplicate.is_published, FALSE),
      'visibilityScope', v_duplicate.visibility_scope,
      'resourceCount', (
        SELECT count(*)
          FROM public.activity_resources ar
         WHERE ar.activity_id = v_duplicate.id
           AND ar.version_id IS NULL
      )
    ),
    p_actor_id
  );

  RETURN jsonb_build_object('activity', to_jsonb(v_duplicate));
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_teacher_activity_atomically(
  p_activity_id UUID,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.activities%ROWTYPE;
  v_activity public.activities%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE p.id = p_actor_id
       AND p.role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'actor is not a teacher' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_current
    FROM public.activities
   WHERE id = p_activity_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity % not found', p_activity_id USING ERRCODE = 'P0002';
  END IF;

  IF v_current.created_by IS DISTINCT FROM p_actor_id THEN
    RAISE EXCEPTION 'teacher does not own activity %', p_activity_id USING ERRCODE = '42501';
  END IF;

  IF v_current.visibility_scope IS DISTINCT FROM 'private' THEN
    RAISE EXCEPTION 'teachers can only archive private owned activities' USING ERRCODE = '42501';
  END IF;

  UPDATE public.activities
     SET status = 'archived',
         updated_at = NOW()
   WHERE id = p_activity_id
   RETURNING * INTO v_activity;

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    operation,
    action,
    visibility,
    old_data,
    new_data,
    changed_by
  )
  VALUES (
    'activities',
    p_activity_id,
    'UPDATE',
    'teacher_activity_archive',
    'tenant',
    jsonb_build_object(
      'status', v_current.status,
      'isPublished', COALESCE(v_current.is_published, FALSE),
      'visibilityScope', v_current.visibility_scope
    ),
    jsonb_build_object(
      'status', v_activity.status,
      'isPublished', COALESCE(v_activity.is_published, FALSE),
      'visibilityScope', v_activity.visibility_scope
    ),
    p_actor_id
  );

  RETURN jsonb_build_object('activity', to_jsonb(v_activity));
END;
$$;

COMMENT ON FUNCTION public.duplicate_teacher_activity_atomically(UUID, UUID) IS
  'Creates a new private draft copy of a teacher-owned private Activity, copying live config and live resources only. Service-role only; validates the actor owns the source Activity.';
COMMENT ON FUNCTION public.archive_teacher_activity_atomically(UUID, UUID) IS
  'Archives a teacher-owned private Activity without deleting versions, assignments, submissions, or family-share metadata. Service-role only; keeps is_published unchanged so existing pinned assignments continue to load.';

REVOKE ALL ON FUNCTION public.duplicate_teacher_activity_atomically(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_teacher_activity_atomically(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_teacher_activity_atomically(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_teacher_activity_atomically(UUID, UUID) TO service_role;

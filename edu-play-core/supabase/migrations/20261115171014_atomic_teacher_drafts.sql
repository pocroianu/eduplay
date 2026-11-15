-- Draft content and its ordered live resources form one consistency rule.
CREATE OR REPLACE FUNCTION public.save_teacher_activity_draft(p_draft JSONB, p_activity_id UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_type public.activity_types%ROWTYPE;
  v_activity public.activities%ROWTYPE;
  v_resources JSONB := coalesce(p_draft->'resources', '[]'::jsonb);
  v_config JSONB;
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_actor AND role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'Teacher required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_draft) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_draft->'title') IS DISTINCT FROM 'string'
    OR length(btrim(p_draft->>'title')) NOT BETWEEN 1 AND 200
    OR jsonb_typeof(p_draft->'prompt') IS DISTINCT FROM 'string'
    OR length(btrim(p_draft->>'prompt')) = 0
    OR jsonb_typeof(p_draft->'allowedTools'->'text') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_draft->'allowedTools'->'drawing') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_draft->'allowedTools'->'voice') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_draft->'shareWithFamilyOnApproval') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(v_resources) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid draft' USING ERRCODE = '22023';
  END IF;
  IF NOT ((p_draft->'allowedTools'->>'text')::boolean
    OR (p_draft->'allowedTools'->>'drawing')::boolean
    OR (p_draft->'allowedTools'->>'voice')::boolean)
    OR jsonb_array_length(v_resources) > 6 THEN
    RAISE EXCEPTION 'Invalid draft tools or resources' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_resources) r WHERE
    jsonb_typeof(r->'title') IS DISTINCT FROM 'string'
    OR length(btrim(r->>'title')) NOT BETWEEN 1 AND 160
    OR jsonb_typeof(r->'url') IS DISTINCT FROM 'string'
    OR btrim(r->>'url') !~* '^https?://[^[:space:]]+$'
  ) THEN
    RAISE EXCEPTION 'Invalid draft resource' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_type FROM public.activity_types WHERE type_id = 'free-response' FOR SHARE;
  IF NOT FOUND OR v_type.authoring_mode IS DISTINCT FROM 'teacher-simple' THEN
    RAISE EXCEPTION 'Activity type unavailable for teachers' USING ERRCODE = 'P0002';
  END IF;
  v_config := jsonb_build_object('prompt', btrim(p_draft->>'prompt'),
    'allowedTools', jsonb_build_object('text', p_draft->'allowedTools'->'text',
      'drawing', p_draft->'allowedTools'->'drawing', 'voice', p_draft->'allowedTools'->'voice'),
    'shareWithFamilyOnApproval', p_draft->'shareWithFamilyOnApproval');

  IF p_activity_id IS NULL THEN
    INSERT INTO public.activities(template, title, description, default_lang, category, difficulty,
      status, is_published, visibility_scope, config_data, config_schema_version, created_by)
    VALUES ('free-response', btrim(p_draft->>'title'), left(btrim(p_draft->>'prompt'), 180), 'ro', 'creative', 'easy',
      'draft', false, 'private', v_config, v_type.version, v_actor)
    RETURNING * INTO v_activity;
  ELSE
    -- The ready operation locks this same row before reading live resources.
    SELECT * INTO v_activity FROM public.activities WHERE id = p_activity_id FOR UPDATE;
    IF NOT FOUND OR v_activity.created_by IS DISTINCT FROM v_actor
      OR v_activity.visibility_scope IS DISTINCT FROM 'private' THEN
      RAISE EXCEPTION 'Private teacher Activity required' USING ERRCODE = '42501';
    END IF;
    IF v_activity.template IS DISTINCT FROM 'free-response' OR v_activity.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'Editable free-response draft required' USING ERRCODE = '23514';
    END IF;
    UPDATE public.activities SET title = btrim(p_draft->>'title'), description = left(btrim(p_draft->>'prompt'), 180),
      config_data = v_config, config_schema_version = v_type.version WHERE id = v_activity.id;
    DELETE FROM public.activity_resources WHERE activity_id = v_activity.id AND version_id IS NULL;
  END IF;
  INSERT INTO public.activity_resources(activity_id, resource_type, title, url, sort_order, created_by)
    SELECT v_activity.id, 'link', btrim(r.value->>'title'), btrim(r.value->>'url'), r.ordinality, v_actor
    FROM jsonb_array_elements(v_resources) WITH ORDINALITY r;
  RETURN v_activity.id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_teacher_activity_draft(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_teacher_activity_draft(JSONB, UUID) TO authenticated;

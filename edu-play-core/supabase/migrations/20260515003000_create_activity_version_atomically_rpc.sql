CREATE OR REPLACE FUNCTION public.create_activity_version_atomically(
  p_activity_id UUID,
  p_activity_type_id TEXT,
  p_config_data JSONB,
  p_config_schema_version INT,
  p_actor_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current activities%ROWTYPE;
  v_next_version INT;
  v_version activity_versions%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_current
    FROM public.activities
   WHERE id = p_activity_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity % not found', p_activity_id USING ERRCODE = 'P0002';
  END IF;

  IF v_current.status IS DISTINCT FROM 'draft'
     OR COALESCE(v_current.is_published, FALSE) IS TRUE THEN
    RAISE EXCEPTION 'activity % is not an unpublished draft', p_activity_id USING ERRCODE = '23514';
  END IF;

  IF v_current.template IS DISTINCT FROM p_activity_type_id THEN
    RAISE EXCEPTION 'activity % draft changed before version insert', p_activity_id USING ERRCODE = '40001';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next_version
    FROM public.activity_versions
   WHERE activity_id = p_activity_id;

  INSERT INTO public.activity_versions (
    activity_id,
    version_number,
    config_data,
    config_schema_version,
    activity_type_id,
    published_by_user_id
  )
  VALUES (
    p_activity_id,
    v_next_version,
    p_config_data,
    p_config_schema_version,
    p_activity_type_id,
    p_actor_id
  )
  RETURNING * INTO v_version;

  RETURN to_jsonb(v_version);
END;
$$;

COMMENT ON FUNCTION public.create_activity_version_atomically(UUID, TEXT, JSONB, INT, UUID) IS
  'Creates a standalone CMS activity_versions snapshot after locking the parent activity and re-checking it is still an unpublished draft.';

REVOKE ALL ON FUNCTION public.create_activity_version_atomically(UUID, TEXT, JSONB, INT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_activity_version_atomically(UUID, TEXT, JSONB, INT, UUID)
  TO service_role;

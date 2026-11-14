-- EDU-475 — Opaque CMS preview sessions + atomic activity publish RPC

CREATE TABLE IF NOT EXISTS public.activity_preview_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  type_id     TEXT NOT NULL REFERENCES public.activity_types(type_id),
  config_data JSONB NOT NULL,
  created_by  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.activity_preview_sessions IS
  'Short-lived opaque CMS draft preview sessions. Stores draft config server-side so iframe URLs never carry unpublished JSON payloads.';

CREATE INDEX IF NOT EXISTS idx_activity_preview_sessions_activity_actor
  ON public.activity_preview_sessions(activity_id, created_by, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_preview_sessions_expires_at
  ON public.activity_preview_sessions(expires_at);

DROP TRIGGER IF EXISTS update_activity_preview_sessions_updated_at ON public.activity_preview_sessions;
CREATE TRIGGER update_activity_preview_sessions_updated_at
  BEFORE UPDATE ON public.activity_preview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.activity_preview_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage own activity preview sessions" ON public.activity_preview_sessions;
CREATE POLICY "Admins manage own activity preview sessions"
  ON public.activity_preview_sessions FOR ALL
  USING (public.is_admin() AND created_by = auth.uid())
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.publish_activity_atomically(
  p_activity_id UUID,
  p_activity_type_id TEXT,
  p_config_data JSONB,
  p_config_schema_version INT,
  p_actor_id UUID,
  p_before_status TEXT,
  p_before_is_published BOOLEAN,
  p_before_config_schema_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current activities%ROWTYPE;
  v_latest activity_versions%ROWTYPE;
  v_version activity_versions%ROWTYPE;
  v_activity activities%ROWTYPE;
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

  IF v_current.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'activity % is not draft', p_activity_id USING ERRCODE = '23514';
  END IF;

  IF v_current.template IS DISTINCT FROM p_activity_type_id
     OR v_current.config_data IS DISTINCT FROM p_config_data
     OR v_current.config_schema_version IS DISTINCT FROM p_config_schema_version THEN
    RAISE EXCEPTION 'activity % draft changed before publish', p_activity_id USING ERRCODE = '40001';
  END IF;

  SELECT *
    INTO v_latest
    FROM public.activity_versions
   WHERE activity_id = p_activity_id
   ORDER BY version_number DESC
   LIMIT 1;

  IF FOUND
     AND v_latest.activity_type_id = p_activity_type_id
     AND v_latest.config_schema_version = p_config_schema_version
     AND v_latest.config_data = p_config_data THEN
    v_version := v_latest;
  ELSE
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
      COALESCE(v_latest.version_number, 0) + 1,
      p_config_data,
      p_config_schema_version,
      p_activity_type_id,
      p_actor_id
    )
    RETURNING * INTO v_version;
  END IF;

  UPDATE public.activities
     SET status = 'published',
         is_published = TRUE,
         config_schema_version = p_config_schema_version,
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
    NULL,
    'activity_published',
    'platform',
    jsonb_build_object(
      'status', p_before_status,
      'isPublished', COALESCE(p_before_is_published, FALSE),
      'configSchemaVersion', p_before_config_schema_version
    ),
    jsonb_build_object(
      'status', v_activity.status,
      'isPublished', COALESCE(v_activity.is_published, FALSE),
      'versionNumber', v_version.version_number,
      'configSchemaVersion', v_activity.config_schema_version
    ),
    p_actor_id
  );

  RETURN jsonb_build_object(
    'activity', to_jsonb(v_activity),
    'version', to_jsonb(v_version)
  );
END;
$$;

COMMENT ON FUNCTION public.publish_activity_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT) IS
  'Publishes a CMS activity in one transaction: create/reuse activity_versions snapshot, update visibility, and write the admin audit log.';

CREATE OR REPLACE FUNCTION public.revert_activity_atomically(
  p_activity_id UUID,
  p_activity_type_id TEXT,
  p_config_data JSONB,
  p_config_schema_version INT,
  p_actor_id UUID,
  p_before_status TEXT,
  p_before_is_published BOOLEAN,
  p_before_config_schema_version INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity activities%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.activities
     SET template = p_activity_type_id,
         config_data = p_config_data,
         config_schema_version = p_config_schema_version,
         status = 'draft',
         is_published = FALSE,
         updated_at = NOW()
   WHERE id = p_activity_id
   RETURNING * INTO v_activity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity % not found', p_activity_id USING ERRCODE = 'P0002';
  END IF;

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
    NULL,
    'activity_reverted',
    'platform',
    jsonb_build_object(
      'status', p_before_status,
      'isPublished', COALESCE(p_before_is_published, FALSE),
      'configSchemaVersion', p_before_config_schema_version
    ),
    jsonb_build_object(
      'status', v_activity.status,
      'isPublished', COALESCE(v_activity.is_published, FALSE),
      'configSchemaVersion', v_activity.config_schema_version
    ),
    p_actor_id
  );

  RETURN jsonb_build_object('activity', to_jsonb(v_activity));
END;
$$;

COMMENT ON FUNCTION public.revert_activity_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT) IS
  'Restores a CMS activity draft from a historical activity_versions snapshot and writes the admin audit log in the same transaction.';

REVOKE ALL ON FUNCTION public.publish_activity_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_activity_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT)
  TO service_role;

REVOKE ALL ON FUNCTION public.revert_activity_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revert_activity_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT)
  TO service_role;

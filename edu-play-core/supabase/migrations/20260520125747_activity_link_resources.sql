-- Link resources for teacher-created activities.
-- Live resources (version_id IS NULL) belong to the editable Activity. Ready
-- snapshots copy those rows to immutable activity_versions so assigned work keeps
-- the resource list that was ready at assignment time.

CREATE TABLE IF NOT EXISTS public.activity_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.activity_versions(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL DEFAULT 'link' CHECK (resource_type IN ('link')),
  title TEXT NOT NULL CHECK (BTRIM(title) <> '' AND char_length(title) <= 160),
  url TEXT NOT NULL CHECK (url ~* '^https?://.+'),
  sort_order INT NOT NULL CHECK (sort_order > 0 AND sort_order <= 20),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_resources_live_order
  ON public.activity_resources(activity_id, sort_order)
  WHERE version_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_resources_version_order
  ON public.activity_resources(version_id, sort_order)
  WHERE version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_resources_activity_version
  ON public.activity_resources(activity_id, version_id, sort_order);

DROP TRIGGER IF EXISTS update_activity_resources_updated_at ON public.activity_resources;
CREATE TRIGGER update_activity_resources_updated_at
  BEFORE UPDATE ON public.activity_resources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_activity_resource_integrity()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_row public.activity_resources%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
  ELSE
    v_row := NEW;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.version_id IS NOT NULL THEN
    RAISE EXCEPTION 'versioned activity resources are immutable' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.activity_id IS DISTINCT FROM OLD.activity_id
       OR NEW.version_id IS DISTINCT FROM OLD.version_id
       OR NEW.resource_type IS DISTINCT FROM OLD.resource_type
       OR NEW.sort_order IS DISTINCT FROM OLD.sort_order THEN
      RAISE EXCEPTION 'activity resource identity, kind, and order are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.version_id IS NOT NULL
     AND COALESCE(current_setting('app.allow_activity_resource_snapshot_insert', TRUE), 'off') IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'versioned activity resources can only be created by the ready snapshot RPC' USING ERRCODE = '42501';
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.activity_versions av
     WHERE av.id = NEW.version_id
       AND av.activity_id = NEW.activity_id
  ) THEN
    RAISE EXCEPTION 'activity resource version must belong to activity' USING ERRCODE = '23514';
  END IF;

  IF v_actor_id IS NULL OR public.is_admin() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;

  IF v_actor_role = 'teacher' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.version_id IS NULL AND EXISTS (
        SELECT 1 FROM public.activities a
         WHERE a.id = OLD.activity_id
           AND a.created_by = v_actor_id
           AND a.visibility_scope = 'private'
      ) THEN
        RETURN OLD;
      END IF;
    ELSE
      IF NEW.version_id IS NULL AND EXISTS (
        SELECT 1 FROM public.activities a
         WHERE a.id = NEW.activity_id
           AND a.created_by = v_actor_id
           AND a.visibility_scope = 'private'
      ) THEN
        NEW.created_by = COALESCE(NEW.created_by, v_actor_id);
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  RAISE EXCEPTION 'not authorized to change activity resources' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_activity_resource_integrity ON public.activity_resources;
CREATE TRIGGER enforce_activity_resource_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON public.activity_resources
  FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_resource_integrity();

ALTER TABLE public.activity_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all activity resources" ON public.activity_resources;
CREATE POLICY "Admins manage all activity resources" ON public.activity_resources
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers view own activity resources" ON public.activity_resources;
CREATE POLICY "Teachers view own activity resources" ON public.activity_resources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.activities a
       WHERE a.id = activity_id
         AND a.created_by = auth.uid()
         AND a.visibility_scope = 'private'
    )
  );

DROP POLICY IF EXISTS "Teachers insert own live activity resources" ON public.activity_resources;
CREATE POLICY "Teachers insert own live activity resources" ON public.activity_resources
  FOR INSERT WITH CHECK (
    version_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.activities a
       WHERE a.id = activity_id
         AND a.created_by = auth.uid()
         AND a.visibility_scope = 'private'
    )
  );

DROP POLICY IF EXISTS "Teachers update own live activity resources" ON public.activity_resources;
CREATE POLICY "Teachers update own live activity resources" ON public.activity_resources
  FOR UPDATE USING (
    version_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.activities a
       WHERE a.id = activity_id
         AND a.created_by = auth.uid()
         AND a.visibility_scope = 'private'
    )
  )
  WITH CHECK (
    version_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.activities a
       WHERE a.id = activity_id
         AND a.created_by = auth.uid()
         AND a.visibility_scope = 'private'
    )
  );

DROP POLICY IF EXISTS "Teachers delete own live activity resources" ON public.activity_resources;
CREATE POLICY "Teachers delete own live activity resources" ON public.activity_resources
  FOR DELETE USING (
    version_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.activities a
       WHERE a.id = activity_id
         AND a.created_by = auth.uid()
         AND a.visibility_scope = 'private'
    )
  );

DROP POLICY IF EXISTS "Students view assigned version activity resources" ON public.activity_resources;
CREATE POLICY "Students view assigned version activity resources" ON public.activity_resources
  FOR SELECT USING (
    version_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.assignments a
       WHERE a.activity_id = activity_resources.activity_id
         AND a.version_id = activity_resources.version_id
         AND public.student_can_access_assignment(auth.uid(), a.id)
    )
  );

DROP POLICY IF EXISTS "Authenticated view public version activity resources" ON public.activity_resources;
CREATE POLICY "Authenticated view public version activity resources" ON public.activity_resources
  FOR SELECT USING (
    version_id IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM public.activity_versions av
        JOIN public.activities a ON a.id = av.activity_id
       WHERE av.id = activity_resources.version_id
         AND a.id = activity_resources.activity_id
         AND a.visibility_scope = 'public'
         AND a.status = 'published'
         AND COALESCE(a.is_published, FALSE)
         AND NOT EXISTS (
           SELECT 1
             FROM public.activity_versions newer
            WHERE newer.activity_id = av.activity_id
              AND newer.version_number > av.version_number
         )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_resources TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.make_teacher_activity_ready_atomically(
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
  v_current public.activities%ROWTYPE;
  v_activity_type public.activity_types%ROWTYPE;
  v_latest public.activity_versions%ROWTYPE;
  v_version public.activity_versions%ROWTYPE;
  v_activity public.activities%ROWTYPE;
  v_live_resources JSONB := '[]'::jsonb;
  v_latest_resources JSONB := '[]'::jsonb;
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
    RAISE EXCEPTION 'teacher ready activities must remain private' USING ERRCODE = '42501';
  END IF;

  IF v_current.status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'activity % cannot be marked ready from status %', p_activity_id, v_current.status USING ERRCODE = '23514';
  END IF;

  IF v_current.status IS DISTINCT FROM p_before_status
     OR COALESCE(v_current.is_published, FALSE) IS DISTINCT FROM COALESCE(p_before_is_published, FALSE)
     OR v_current.config_schema_version IS DISTINCT FROM p_before_config_schema_version THEN
    RAISE EXCEPTION 'activity % changed before ready snapshot', p_activity_id USING ERRCODE = '40001';
  END IF;

  IF v_current.template IS DISTINCT FROM p_activity_type_id
     OR v_current.config_data IS DISTINCT FROM p_config_data
     OR v_current.config_schema_version IS DISTINCT FROM p_config_schema_version THEN
    RAISE EXCEPTION 'activity % config changed before ready snapshot', p_activity_id USING ERRCODE = '40001';
  END IF;

  IF p_config_data IS NULL OR p_config_schema_version IS NULL THEN
    RAISE EXCEPTION 'activity % has no config to snapshot', p_activity_id USING ERRCODE = '23514';
  END IF;

  SELECT *
    INTO v_activity_type
    FROM public.activity_types
   WHERE type_id = p_activity_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'activity type % not found', p_activity_type_id USING ERRCODE = 'P0002';
  END IF;

  IF v_activity_type.authoring_mode IS DISTINCT FROM 'teacher-simple' THEN
    RAISE EXCEPTION 'activity type % is not teacher-authorable', p_activity_type_id USING ERRCODE = '42501';
  END IF;

  IF v_activity_type.version IS DISTINCT FROM p_config_schema_version THEN
    RAISE EXCEPTION 'activity % config schema version is stale', p_activity_id USING ERRCODE = '23514';
  END IF;

  IF NOT extensions.jsonb_matches_schema(v_activity_type.config_schema::json, p_config_data) THEN
    RAISE EXCEPTION 'activity % config does not match activity type schema', p_activity_id USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object('resource_type', resource_type, 'title', title, 'url', url)
             ORDER BY sort_order
           ),
           '[]'::jsonb
         )
    INTO v_live_resources
    FROM public.activity_resources
   WHERE activity_id = p_activity_id
     AND version_id IS NULL;

  SELECT *
    INTO v_latest
    FROM public.activity_versions
   WHERE activity_id = p_activity_id
   ORDER BY version_number DESC
   LIMIT 1;

  IF FOUND THEN
    SELECT COALESCE(
             jsonb_agg(
               jsonb_build_object('resource_type', resource_type, 'title', title, 'url', url)
               ORDER BY sort_order
             ),
             '[]'::jsonb
           )
      INTO v_latest_resources
      FROM public.activity_resources
     WHERE version_id = v_latest.id;
  END IF;

  IF FOUND
     AND v_latest.activity_type_id = p_activity_type_id
     AND v_latest.config_schema_version = p_config_schema_version
     AND v_latest.config_data = p_config_data
     AND v_latest_resources = v_live_resources THEN
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

    PERFORM set_config('app.allow_activity_resource_snapshot_insert', 'on', TRUE);

    INSERT INTO public.activity_resources (
      activity_id,
      version_id,
      resource_type,
      title,
      url,
      sort_order,
      created_by
    )
    SELECT activity_id,
           v_version.id,
           resource_type,
           title,
           url,
           sort_order,
           created_by
      FROM public.activity_resources
     WHERE activity_id = p_activity_id
       AND version_id IS NULL
     ORDER BY sort_order;

    PERFORM set_config('app.allow_activity_resource_snapshot_insert', 'off', TRUE);
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
    'UPDATE',
    'teacher_activity_ready',
    'tenant',
    jsonb_build_object(
      'status', p_before_status,
      'isPublished', COALESCE(p_before_is_published, FALSE),
      'visibilityScope', v_current.visibility_scope,
      'configSchemaVersion', p_before_config_schema_version
    ),
    jsonb_build_object(
      'status', v_activity.status,
      'isPublished', COALESCE(v_activity.is_published, FALSE),
      'visibilityScope', v_activity.visibility_scope,
      'versionNumber', v_version.version_number,
      'configSchemaVersion', v_activity.config_schema_version,
      'resourceCount', jsonb_array_length(v_live_resources)
    ),
    p_actor_id
  );

  RETURN jsonb_build_object(
    'activity', to_jsonb(v_activity),
    'version', to_jsonb(v_version)
  );
END;
$$;

COMMENT ON TABLE public.activity_resources IS
  'Ordered teacher-provided resources for Activities. version_id NULL rows are editable live resources; version_id rows are immutable snapshots for assigned versions.';
COMMENT ON FUNCTION public.make_teacher_activity_ready_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT) IS
  'Marks a teacher-owned private Activity ready to assign, validates the current teacher-simple config, and creates/reuses an immutable private activity_versions snapshot including ordered link resources. Service-role only; does not publish to the public catalog.';

REVOKE ALL ON FUNCTION public.make_teacher_activity_ready_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.make_teacher_activity_ready_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT) TO service_role;

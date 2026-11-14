-- Teacher-created Activity ready flow: private immutable snapshots.

CREATE EXTENSION IF NOT EXISTS pg_jsonschema WITH SCHEMA extensions;

-- Replace the broad owner-teacher FOR ALL policy with explicit read/write
-- policies. Ready/versioned Activities should not be deletable through direct
-- client writes because that would cascade immutable versions and assignments.
DROP POLICY IF EXISTS "Teachers manage own private activities" ON public.activities;
DROP POLICY IF EXISTS "Teachers read own private activities" ON public.activities;
DROP POLICY IF EXISTS "Teachers create own private activities" ON public.activities;
DROP POLICY IF EXISTS "Teachers update own private activities" ON public.activities;

CREATE POLICY "Teachers read own private activities"
  ON public.activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
    AND created_by = auth.uid()
    AND visibility_scope = 'private'
  );

CREATE POLICY "Teachers create own private activities"
  ON public.activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
    AND created_by = auth.uid()
    AND visibility_scope = 'private'
  );

CREATE POLICY "Teachers update own private activities"
  ON public.activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
    AND created_by = auth.uid()
    AND visibility_scope = 'private'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
    AND created_by = auth.uid()
    AND visibility_scope = 'private'
  );

-- Teachers may keep editing their own private Activity's live config after it is
-- ready, but cannot directly flip lifecycle/scope/owner fields through RLS.
CREATE OR REPLACE FUNCTION public.enforce_admin_only_lifecycle_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role / postgres bypass: auth.uid() is NULL when called outside an
  -- authenticated request (server actions using the service-role key, SQL
  -- migrations, supabase CLI). Those callers are trusted by RLS already.
  IF auth.uid() IS NULL OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'teacher'
  ) THEN
    RAISE EXCEPTION 'activities lifecycle columns are restricted'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'teachers can only create their own activities'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.visibility_scope IS DISTINCT FROM 'private' THEN
      RAISE EXCEPTION 'teachers can only create private activities'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM 'draft' THEN
      RAISE EXCEPTION 'teachers cannot create ready/published activities directly'
        USING ERRCODE = '42501';
    END IF;

    IF COALESCE(NEW.is_published, FALSE) IS TRUE THEN
      RAISE EXCEPTION 'teachers cannot publish activities directly'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'activities.created_by cannot be changed by teachers'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'teachers can only edit their own activities'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.visibility_scope IS DISTINCT FROM 'private'
     OR OLD.visibility_scope IS DISTINCT FROM 'private' THEN
    RAISE EXCEPTION 'teachers can only edit private activities'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'teachers cannot change activity status directly'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(NEW.is_published, FALSE) IS DISTINCT FROM COALESCE(OLD.is_published, FALSE) THEN
    RAISE EXCEPTION 'teachers cannot change activity readiness directly'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status NOT IN ('draft', 'published') THEN
    RAISE EXCEPTION 'teachers can only edit draft or ready private activities'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.enforce_admin_only_lifecycle_columns() IS
  'Defense-in-depth gate for Activity lifecycle/scope columns. Teachers may edit live config on their own private draft or ready rows, but cannot spoof ownership, change visibility scope, or mark Activities ready/published directly.';

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

COMMENT ON FUNCTION public.make_teacher_activity_ready_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT) IS
  'Marks a teacher-owned private Activity ready to assign, validates the current teacher-simple config, and creates/reuses an immutable private activity_versions snapshot. Service-role only; does not publish to the public catalog.';

REVOKE ALL ON FUNCTION public.make_teacher_activity_ready_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.make_teacher_activity_ready_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT) TO service_role;

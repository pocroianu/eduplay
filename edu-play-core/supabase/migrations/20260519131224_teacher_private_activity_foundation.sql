-- Teacher-created Activity foundation: private visibility scope and free-response type.

-- 1. Activity visibility scope -------------------------------------------------
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS visibility_scope TEXT
  CHECK (visibility_scope IN ('private', 'school', 'public'));

UPDATE public.activities
SET visibility_scope = CASE
  WHEN COALESCE(is_published, FALSE) = TRUE THEN 'public'
  ELSE 'private'
END
WHERE visibility_scope IS NULL;

ALTER TABLE public.activities
  ALTER COLUMN visibility_scope SET DEFAULT 'private',
  ALTER COLUMN visibility_scope SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_public_visibility
  ON public.activities (visibility_scope, status, is_published)
  WHERE visibility_scope = 'public';

CREATE INDEX IF NOT EXISTS idx_activities_owner_visibility_status
  ON public.activities (created_by, visibility_scope, status);

COMMENT ON COLUMN public.activities.visibility_scope IS
  'Discovery scope for first-class Activities. private teacher Activities can be ready/assigned without becoming public catalog content; school/public are reserved for broader sharing.';

-- Tighten Activity RLS. Existing public rows stay visible; teachers only manage
-- their own private Activities; admins keep full access.
DROP POLICY IF EXISTS "Anyone can view published activities" ON public.activities;
DROP POLICY IF EXISTS "Admins can manage activities" ON public.activities;
DROP POLICY IF EXISTS "Public reads public published activities" ON public.activities;
DROP POLICY IF EXISTS "Teachers manage own private activities" ON public.activities;
DROP POLICY IF EXISTS "Admins manage all activities" ON public.activities;

CREATE POLICY "Public reads public published activities"
  ON public.activities FOR SELECT
  USING (
    visibility_scope = 'public'
    AND status = 'published'
    AND COALESCE(is_published, FALSE) = TRUE
  );

CREATE POLICY "Teachers manage own private activities"
  ON public.activities FOR ALL
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

CREATE POLICY "Admins manage all activities"
  ON public.activities FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Public activity_versions RLS must not leak private ready Activities.
CREATE OR REPLACE FUNCTION public.is_activity_published(p_activity_id UUID)
RETURNS BOOLEAN AS $$
  SELECT status = 'published'
     AND COALESCE(is_published, FALSE)
     AND visibility_scope = 'public'
  FROM public.activities
  WHERE id = p_activity_id;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE;

COMMENT ON FUNCTION public.is_activity_published(UUID) IS
  'Returns true only for public published Activities. Private ready teacher Activities must not leak through public activity_versions RLS.';

-- Relax lifecycle hardening only for teacher-owned private drafts. Teachers may
-- store draft config for their own private Activities, but cannot spoof owners,
-- change scope, or mark rows ready/public via direct Supabase writes.
CREATE OR REPLACE FUNCTION public.enforce_admin_only_lifecycle_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Service-role / postgres bypass: auth.uid() is NULL when called outside an
  -- authenticated request (server actions using the service-role key, SQL
  -- migrations, supabase CLI). Those callers are trusted by RLS already.
  IF auth.uid() IS NULL THEN
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

  IF NEW.status IS DISTINCT FROM 'draft'
     OR OLD.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'teachers can only edit draft lifecycle data directly'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(NEW.is_published, FALSE) IS TRUE
     OR COALESCE(OLD.is_published, FALSE) IS TRUE THEN
    RAISE EXCEPTION 'teachers cannot publish activities directly'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS activities_lifecycle_columns_admin_only ON public.activities;
CREATE TRIGGER activities_lifecycle_columns_admin_only
  BEFORE INSERT OR UPDATE OF status, is_published, config_data, config_schema_version, visibility_scope, created_by
  ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_only_lifecycle_columns();

COMMENT ON FUNCTION public.enforce_admin_only_lifecycle_columns() IS
  'Defense-in-depth gate for Activity lifecycle/scope columns. Teachers may save validated config on their own private drafts, but cannot spoof ownership, change visibility scope, or mark Activities ready/published directly.';


-- Admin CMS publish still means public catalog publish. Teacher "ready to assign"
-- will use a separate owner-scoped ready/version path later so private teacher
-- Activities are not accidentally made public.
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
         visibility_scope = 'public',
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

COMMENT ON FUNCTION public.publish_activity_atomically(UUID, TEXT, JSONB, INT, UUID, TEXT, BOOLEAN, INT) IS
  'Publishes an admin/CMS Activity in one transaction and marks it public; teacher-private ready flows must use a separate owner-scoped path.';

-- 2. Activity type capabilities and free-response seed -----------------------
ALTER TABLE public.activity_types
  ADD COLUMN IF NOT EXISTS renderer_kind TEXT NOT NULL DEFAULT 'iframe'
    CHECK (renderer_kind IN ('iframe', 'react')),
  ADD COLUMN IF NOT EXISTS authoring_mode TEXT NOT NULL DEFAULT 'admin-only'
    CHECK (authoring_mode IN ('admin-only', 'teacher-simple', 'hidden')),
  ADD COLUMN IF NOT EXISTS produces_submission BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS supports_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_auto_scored BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.activity_types.renderer_kind IS
  'Renderer surface for the player shell. iframe renderers are Phaser templates; react renderers are native app activities.';
COMMENT ON COLUMN public.activity_types.authoring_mode IS
  'Controls whether a type is authorable by teachers, admins only, or hidden from authoring surfaces.';
COMMENT ON COLUMN public.activity_types.produces_submission IS
  'Whether this type creates student submission/review records rather than only progress telemetry.';
COMMENT ON COLUMN public.activity_types.supports_review IS
  'Whether teacher review actions apply to submissions produced by this type.';
COMMENT ON COLUMN public.activity_types.is_auto_scored IS
  'Whether completion/progress is automatically scored by the renderer.';

INSERT INTO public.activity_types (
  type_id,
  display_name,
  category,
  config_schema,
  renderer_key,
  renderer_kind,
  authoring_mode,
  produces_submission,
  supports_review,
  is_auto_scored,
  version
)
VALUES (
  'free-response',
  'Free response',
  'creative',
  '{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": ["prompt", "allowedTools", "shareWithFamilyOnApproval"],
    "additionalProperties": false,
    "properties": {
      "prompt": { "type": "string", "minLength": 1, "pattern": "\\S" },
      "allowedTools": {
        "type": "object",
        "required": ["text", "drawing", "voice"],
        "additionalProperties": false,
        "properties": {
          "text": { "type": "boolean" },
          "drawing": { "type": "boolean" },
          "voice": { "type": "boolean" }
        }
      },
      "shareWithFamilyOnApproval": { "type": "boolean" }
    },
    "anyOf": [
      { "properties": { "allowedTools": { "properties": { "text": { "const": true } } } } },
      { "properties": { "allowedTools": { "properties": { "drawing": { "const": true } } } } },
      { "properties": { "allowedTools": { "properties": { "voice": { "const": true } } } } }
    ]
  }'::jsonb,
  'free-response',
  'react',
  'teacher-simple',
  TRUE,
  TRUE,
  FALSE,
  1
)
ON CONFLICT (type_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    config_schema = EXCLUDED.config_schema,
    renderer_key = EXCLUDED.renderer_key,
    renderer_kind = EXCLUDED.renderer_kind,
    authoring_mode = EXCLUDED.authoring_mode,
    produces_submission = EXCLUDED.produces_submission,
    supports_review = EXCLUDED.supports_review,
    is_auto_scored = EXCLUDED.is_auto_scored,
    version = GREATEST(public.activity_types.version, EXCLUDED.version),
    updated_at = NOW();

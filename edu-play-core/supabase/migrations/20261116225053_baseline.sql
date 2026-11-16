-- Squashed baseline, 2026-11-16; issue #6.

DO $bootstrap$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'directus_admin') THEN
    CREATE ROLE directus_admin NOLOGIN BYPASSRLS;
  END IF;
  IF NOT pg_has_role('postgres', 'directus_admin', 'MEMBER') THEN
    GRANT directus_admin TO postgres;
  END IF;
END
$bootstrap$;

CREATE SCHEMA IF NOT EXISTS directus AUTHORIZATION directus_admin;



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "directus";


ALTER SCHEMA "directus" OWNER TO "directus_admin";


COMMENT ON SCHEMA "directus" IS 'Holds Directus system tables (directus_users, directus_collections, directus_permissions, etc). Owned by directus_admin; do not edit by hand.';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_jsonschema" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."content_visibility" AS ENUM (
    'draft',
    'internal_teacher_only',
    'family_visible',
    'archived'
);


ALTER TYPE "public"."content_visibility" OWNER TO "postgres";


CREATE TYPE "public"."visibility_status" AS ENUM (
    'draft',
    'internal_teacher_only',
    'family_visible',
    'archived'
);


ALTER TYPE "public"."visibility_status" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."native_activity_submissions" (
    "id" "uuid" NOT NULL,
    "instance_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "artifact_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."native_activity_submissions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_native_activity_submission"("p_student_id" "uuid", "p_instance_id" "uuid", "p_submission_id" "uuid", "p_type_id" "text", "p_storage_path" "text", "p_duration_ms" integer DEFAULT NULL::integer) RETURNS "public"."native_activity_submissions"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."accept_native_activity_submission"("p_student_id" "uuid", "p_instance_id" "uuid", "p_submission_id" "uuid", "p_type_id" "text", "p_storage_path" "text", "p_duration_ms" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."activity_version_shares_with_family"("p_version_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    (
      SELECT av.config_data @> '{"shareWithFamilyOnApproval": true}'::jsonb
        FROM public.activity_versions av
       WHERE av.id = p_version_id
    ),
    FALSE
  );
$$;


ALTER FUNCTION "public"."activity_version_shares_with_family"("p_version_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."activity_version_shares_with_family"("p_version_id" "uuid") IS 'Returns true when an immutable activity version opts approved work into future family sharing.';



CREATE OR REPLACE FUNCTION "public"."advance_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_completed_step_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."advance_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_completed_step_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."advance_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_completed_step_id" "uuid") IS 'Trusted server completion transition. Call only after scoped Activity completion matching; students cannot invoke it directly.';



CREATE TABLE IF NOT EXISTS "public"."learning_path_steps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "path_id" "uuid" NOT NULL,
    "step_order" integer NOT NULL,
    "kind" "text" NOT NULL,
    "target_activity_type" "text",
    "target_activity_config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "learning_path_steps_kind_check" CHECK ((("kind" = 'activity_template'::"text") AND ("target_activity_type" IS NOT NULL)))
);


ALTER TABLE "public"."learning_path_steps" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."append_learning_path_step"("p_path_id" "uuid", "p_title" "text", "p_activity_type" "text", "p_config" "jsonb" DEFAULT '{}'::"jsonb", "p_description" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."learning_path_steps"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE v_status text; v_order int;
BEGIN
  SELECT status INTO v_status FROM public.learning_paths WHERE id=p_path_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'learning_path_not_found' USING ERRCODE='P0002'; END IF;
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'learning_path_not_draft' USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.activity_types WHERE type_id=p_activity_type) THEN
    RAISE EXCEPTION 'activity_type_not_found' USING ERRCODE='22023';
  END IF;
  SELECT COALESCE(max(step_order),-1)+1 INTO v_order FROM public.learning_path_steps WHERE path_id=p_path_id;
  RETURN QUERY INSERT INTO public.learning_path_steps(path_id,step_order,kind,title,target_activity_type,target_activity_config,description)
    VALUES(p_path_id,v_order,'activity_template',p_title,p_activity_type,COALESCE(p_config,'{}'::jsonb),p_description)
    RETURNING *;
END;
$$;


ALTER FUNCTION "public"."append_learning_path_step"("p_path_id" "uuid", "p_title" "text", "p_activity_type" "text", "p_config" "jsonb", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."archive_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."archive_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."archive_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") IS 'Archives a teacher-owned private Activity without deleting versions, assignments, submissions, or family-share metadata. Service-role only; keeps is_published unchanged so existing pinned assignments continue to load.';



CREATE OR REPLACE FUNCTION "public"."audit_log_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  record_uuid UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    record_uuid := OLD.id;
    INSERT INTO audit_logs (table_name, record_id, operation, old_data, changed_by)
    VALUES (TG_TABLE_NAME, record_uuid, TG_OP, to_jsonb(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    record_uuid := NEW.id;
    INSERT INTO audit_logs (table_name, record_id, operation, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, record_uuid, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    record_uuid := NEW.id;
    INSERT INTO audit_logs (table_name, record_id, operation, new_data, changed_by)
    VALUES (TG_TABLE_NAME, record_uuid, TG_OP, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."audit_log_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."capture_activity_day"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Teacher adjustments and demo fixtures are not learner engagement.
  IF auth.uid() = NEW.student_id AND NEW.status <> 'not_started' THEN
    INSERT INTO public.activity_days(student_id, active_day)
      VALUES (NEW.student_id, (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."capture_activity_day"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_artifact_visibility"("p_artifact_id" "uuid", "p_visibility" "text") RETURNS TABLE("artifact" "jsonb", "became_family_visible" boolean)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."change_artifact_visibility"("p_artifact_id" "uuid", "p_visibility" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_activity_version_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."create_activity_version_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_activity_version_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid") IS 'Creates a standalone CMS activity_versions snapshot after locking the parent activity and re-checking it is still an unpublished draft.';



CREATE OR REPLACE FUNCTION "public"."create_parent_notification_preferences"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.role = 'parent' THEN
    INSERT INTO public.parent_notification_preferences (parent_id)
    VALUES (NEW.id)
    ON CONFLICT (parent_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_parent_notification_preferences"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duplicate_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."duplicate_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."duplicate_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") IS 'Creates a new private draft copy of a teacher-owned private Activity, copying live config and live resources only. Service-role only; validates the actor owns the source Activity.';



CREATE OR REPLACE FUNCTION "public"."enforce_activity_resource_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."enforce_activity_resource_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_activity_submission_attempt_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_submission public.activity_submissions%ROWTYPE;
  v_assignment public.assignments%ROWTYPE;
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
BEGIN
  IF v_actor_id IS NOT NULL THEN
    SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'submitted' THEN
      RAISE EXCEPTION 'submitted attempts are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  SELECT * INTO v_submission
    FROM public.activity_submissions
   WHERE id = NEW.submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'attempt submission % not found', NEW.submission_id USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = v_submission.assignment_id;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.submission_id IS DISTINCT FROM OLD.submission_id
       OR NEW.attempt_number IS DISTINCT FROM OLD.attempt_number THEN
      RAISE EXCEPTION 'attempt submission and number are immutable' USING ERRCODE = '23514';
    END IF;

    IF OLD.status = 'submitted' THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.response IS DISTINCT FROM OLD.response
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
         OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'submitted attempt response content is immutable' USING ERRCODE = '23514';
      END IF;

      IF v_actor_id IS NULL OR public.is_admin() THEN
        RETURN NEW;
      END IF;

      IF v_actor_role = 'teacher' AND v_assignment.teacher_id = v_actor_id THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'only the owning teacher can review submitted attempts' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_actor_id IS NULL OR public.is_admin() THEN
    IF NEW.status = 'submitted' THEN
      NEW.submitted_at = COALESCE(NEW.submitted_at, NOW());
      NEW.review_status = 'pending';
      NEW.reviewed_by = NULL;
      NEW.reviewed_at = NULL;
      NEW.teacher_feedback = NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF v_actor_role = 'student' THEN
    IF v_actor_id IS DISTINCT FROM v_submission.student_id THEN
      RAISE EXCEPTION 'students can only change their own attempts' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' THEN
      IF NEW.status <> 'draft' OR v_submission.status NOT IN ('draft', 'needs_revision') THEN
        RAISE EXCEPTION 'students can only create draft attempts for editable submissions' USING ERRCODE = '42501';
      END IF;
      NEW.review_status = 'pending';
      NEW.reviewed_by = NULL;
      NEW.reviewed_at = NULL;
      NEW.teacher_feedback = NULL;
      RETURN NEW;
    END IF;

    IF v_submission.status NOT IN ('draft', 'needs_revision') THEN
      RAISE EXCEPTION 'attempts are editable only while the submission is editable' USING ERRCODE = '42501';
    END IF;

    IF NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'invalid attempt status' USING ERRCODE = '23514';
    END IF;

    IF NEW.review_status IS DISTINCT FROM OLD.review_status
       OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
       OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
       OR NEW.teacher_feedback IS DISTINCT FROM OLD.teacher_feedback THEN
      RAISE EXCEPTION 'students cannot set review fields' USING ERRCODE = '42501';
    END IF;

    IF NEW.status = 'submitted' THEN
      NEW.submitted_at = COALESCE(NEW.submitted_at, NOW());
      NEW.review_status = 'pending';
      NEW.reviewed_by = NULL;
      NEW.reviewed_at = NULL;
      NEW.teacher_feedback = NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'teacher' THEN
    RAISE EXCEPTION 'teachers cannot change student attempts directly' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_activity_submission_attempt_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_activity_submission_family_share_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_attempt public.activity_submission_attempts%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
       OR NEW.submission_id IS DISTINCT FROM OLD.submission_id THEN
      RAISE EXCEPTION 'family share attempt and submission are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT * INTO v_attempt
    FROM public.activity_submission_attempts
   WHERE id = NEW.attempt_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'family share attempt % not found', NEW.attempt_id USING ERRCODE = '23503';
  END IF;

  IF v_attempt.submission_id IS DISTINCT FROM NEW.submission_id THEN
    RAISE EXCEPTION 'family share submission must match attempt submission' USING ERRCODE = '23514';
  END IF;

  IF v_attempt.status <> 'submitted' OR v_attempt.review_status <> 'approved' THEN
    RAISE EXCEPTION 'only approved submitted attempts can be family-share eligible' USING ERRCODE = '23514';
  END IF;

  NEW.family_comment := NULLIF(BTRIM(COALESCE(NEW.family_comment, '')), '');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_activity_submission_family_share_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_activity_submission_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_assignment public.assignments%ROWTYPE;
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_feedback TEXT;
  v_family_share_eligible BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.assignment_id IS DISTINCT FROM OLD.assignment_id
       OR NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.activity_id IS DISTINCT FROM OLD.activity_id
       OR NEW.version_id IS DISTINCT FROM OLD.version_id THEN
      RAISE EXCEPTION 'submission assignment, student, activity and version are immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = NEW.assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission assignment % not found', NEW.assignment_id USING ERRCODE = '23503';
  END IF;

  IF v_assignment.activity_id IS DISTINCT FROM NEW.activity_id THEN
    RAISE EXCEPTION 'submission activity does not match assignment' USING ERRCODE = '23514';
  END IF;

  IF v_assignment.version_id IS DISTINCT FROM NEW.version_id THEN
    RAISE EXCEPTION 'submission version does not match assignment' USING ERRCODE = '23514';
  END IF;

  IF NOT public.student_can_access_assignment(NEW.student_id, NEW.assignment_id) THEN
    RAISE EXCEPTION 'student is not targeted by assignment' USING ERRCODE = '42501';
  END IF;

  IF NEW.latest_attempt_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.activity_submission_attempts attempt
     WHERE attempt.id = NEW.latest_attempt_id
       AND attempt.submission_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'latest attempt must belong to submission' USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'submitted' AND NOT EXISTS (
    SELECT 1
      FROM public.activity_submission_attempts attempt
     WHERE attempt.id = NEW.latest_attempt_id
       AND attempt.submission_id = NEW.id
       AND attempt.status = 'submitted'
       AND attempt.attempt_number = NEW.latest_attempt_number
       AND attempt.response = NEW.latest_response
  ) THEN
    RAISE EXCEPTION 'submitted submission must reference its submitted latest attempt' USING ERRCODE = '23514';
  END IF;

  IF v_actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_actor_role = 'student' THEN
      IF v_actor_id IS DISTINCT FROM NEW.student_id OR NEW.status <> 'draft' THEN
        RAISE EXCEPTION 'students can only create their own draft submissions' USING ERRCODE = '42501';
      END IF;
      IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.teacher_feedback IS NOT NULL THEN
        RAISE EXCEPTION 'students cannot set review fields' USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END IF;

    IF v_actor_role = 'teacher' THEN
      RAISE EXCEPTION 'teachers cannot create student submissions' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'student' THEN
    IF v_actor_id IS DISTINCT FROM NEW.student_id THEN
      RAISE EXCEPTION 'students can only update their own submissions' USING ERRCODE = '42501';
    END IF;

    IF OLD.status NOT IN ('draft', 'needs_revision') OR NEW.status NOT IN ('draft', 'submitted') THEN
      RAISE EXCEPTION 'invalid student submission transition' USING ERRCODE = '42501';
    END IF;

    NEW.reviewed_by = NULL;
    NEW.reviewed_at = NULL;
    NEW.teacher_feedback = NULL;

    IF NEW.status = 'submitted' THEN
      NEW.submitted_at = COALESCE(NEW.submitted_at, NOW());
    END IF;

    RETURN NEW;
  END IF;

  IF v_actor_role = 'teacher' THEN
    IF v_assignment.teacher_id IS DISTINCT FROM v_actor_id THEN
      RAISE EXCEPTION 'teachers can only review submissions for their assignments' USING ERRCODE = '42501';
    END IF;

    IF OLD.status <> 'submitted' OR NEW.status NOT IN ('needs_revision', 'approved') THEN
      RAISE EXCEPTION 'invalid teacher review transition' USING ERRCODE = '42501';
    END IF;

    IF NEW.latest_attempt_id IS DISTINCT FROM OLD.latest_attempt_id
       OR NEW.latest_attempt_number IS DISTINCT FROM OLD.latest_attempt_number
       OR NEW.latest_response IS DISTINCT FROM OLD.latest_response
       OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'teachers cannot change submitted response content' USING ERRCODE = '42501';
    END IF;

    v_feedback := NULLIF(BTRIM(COALESCE(NEW.teacher_feedback, '')), '');
    IF NEW.status = 'needs_revision' AND v_feedback IS NULL THEN
      RAISE EXCEPTION 'revision feedback is required' USING ERRCODE = '23514';
    END IF;

    v_family_share_eligible := NEW.status = 'approved'
      AND public.activity_version_shares_with_family(NEW.version_id);

    NEW.reviewed_by = v_actor_id;
    NEW.reviewed_at = NOW();
    NEW.teacher_feedback = CASE WHEN NEW.status = 'needs_revision' THEN v_feedback ELSE NULL END;

    UPDATE public.activity_submission_attempts
       SET review_status = NEW.status,
           reviewed_by = NEW.reviewed_by,
           reviewed_at = NEW.reviewed_at,
           teacher_feedback = NEW.teacher_feedback
     WHERE id = NEW.latest_attempt_id
       AND submission_id = NEW.id
       AND status = 'submitted';

    IF v_family_share_eligible THEN
      INSERT INTO public.activity_submission_family_shares (attempt_id, submission_id, family_comment)
      VALUES (NEW.latest_attempt_id, NEW.id, NULL)
      ON CONFLICT (attempt_id) DO UPDATE
      SET family_comment = public.activity_submission_family_shares.family_comment,
          updated_at = NOW();
    ELSE
      DELETE FROM public.activity_submission_family_shares
       WHERE attempt_id = NEW.latest_attempt_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_activity_submission_integrity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_admin_only_lifecycle_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."enforce_admin_only_lifecycle_columns"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_admin_only_lifecycle_columns"() IS 'Defense-in-depth gate for Activity lifecycle/scope columns. Teachers may edit live config on their own private draft or ready rows, but cannot spoof ownership, change visibility scope, or mark Activities ready/published directly.';



CREATE OR REPLACE FUNCTION "public"."enforce_assignment_activity_integrity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_activity public.activities%ROWTYPE;
  v_version public.activity_versions%ROWTYPE;
BEGIN
  IF NEW.activity_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_activity
    FROM public.activities
   WHERE id = NEW.activity_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment activity % not found', NEW.activity_id USING ERRCODE = '23503';
  END IF;

  IF v_activity.status IS DISTINCT FROM 'published'
     OR COALESCE(v_activity.is_published, FALSE) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'assignments can only target ready activities' USING ERRCODE = '23514';
  END IF;

  IF v_activity.visibility_scope = 'private'
     AND v_activity.created_by IS DISTINCT FROM NEW.teacher_id THEN
    RAISE EXCEPTION 'teachers can only assign their own private activities' USING ERRCODE = '42501';
  END IF;

  IF NEW.version_id IS NULL THEN
    RAISE EXCEPTION 'activity assignments must pin a version' USING ERRCODE = '23514';
  END IF;

  SELECT *
    INTO v_version
    FROM public.activity_versions
   WHERE id = NEW.version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment version % not found', NEW.version_id USING ERRCODE = '23503';
  END IF;

  IF v_version.activity_id IS DISTINCT FROM NEW.activity_id THEN
    RAISE EXCEPTION 'assignment version does not belong to activity' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_assignment_activity_integrity"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_assignment_activity_integrity"() IS 'Ensures Activity assignments target ready activities, pin a version for the same activity, and do not let teachers assign private Activities owned by another teacher.';



CREATE OR REPLACE FUNCTION "public"."enforce_parent_only_student_consents"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_setting('eduplay.allow_child_consent_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.consents IS DISTINCT FROM OLD.consents THEN
    RAISE EXCEPTION 'students.consents is parent-only'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_parent_only_student_consents"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_parent_only_student_consents"() IS 'Rejects direct authenticated writes to students.consents so parent consent remains parent-controlled despite row-level teacher UPDATE policies. EDU-295.';



CREATE OR REPLACE FUNCTION "public"."execute_pending_deletions"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER := 0;
  v_request RECORD;
BEGIN
  FOR v_request IN
    SELECT dr.id, dr.user_id, p.email
    FROM deletion_requests dr
    JOIN profiles p ON p.id = dr.user_id
    WHERE dr.status = 'pending'
      AND dr.scheduled_deletion_at <= NOW()
    FOR UPDATE OF dr SKIP LOCKED
  LOOP
    -- Clear non-cascading FK references
    UPDATE parent_invite_codes SET used_by = NULL WHERE used_by = v_request.user_id;

    -- Delete password reset requests (no FK, matched by email)
    DELETE FROM password_reset_requests WHERE email = v_request.email;

    -- Delete from auth.users — cascades to profiles and all FK-linked tables
    DELETE FROM auth.users WHERE id = v_request.user_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."execute_pending_deletions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."execute_pending_deletions"() IS 'Executes matured GDPR deletion requests. Call via cron or edge function. Returns count of deleted users.';



CREATE OR REPLACE FUNCTION "public"."get_latest_activity_version_number"("p_activity_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT MAX(version_number) FROM public.activity_versions WHERE activity_id = p_activity_id;
$$;


ALTER FUNCTION "public"."get_latest_activity_version_number"("p_activity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_parent_child_ids"("parent_uid" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT student_id FROM parent_children
  WHERE parent_id = parent_uid AND status = 'active';
$$;


ALTER FUNCTION "public"."get_parent_child_ids"("parent_uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_parent_student_class_ids"("parent_uuid" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT s.class_id
  FROM public.students s
  LEFT JOIN public.parent_children pc ON s.id = pc.student_id
  WHERE s.class_id IS NOT NULL
    AND (
      (pc.parent_id = parent_uuid AND pc.status = 'active')
      OR s.parent_id = parent_uuid
    );
$$;


ALTER FUNCTION "public"."get_parent_student_class_ids"("parent_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_parent_student_ids"("parent_uuid" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT DISTINCT s.id
  FROM public.students s
  LEFT JOIN public.parent_children pc ON s.id = pc.student_id
  WHERE (pc.parent_id = parent_uuid AND pc.status = 'active')
     OR s.parent_id = parent_uuid;
$$;


ALTER FUNCTION "public"."get_parent_student_ids"("parent_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_student_classmates"("p_student_id" "uuid") RETURNS TABLE("id" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT s.id
  FROM students s
  WHERE s.class_id IS NOT NULL
    AND s.class_id = (SELECT class_id FROM students WHERE id = p_student_id)
    AND s.id <> p_student_id;
$$;


ALTER FUNCTION "public"."get_student_classmates"("p_student_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_student_classmates"("p_student_id" "uuid") IS 'Returns classmates of a student (same class_id, excluding self). SECURITY DEFINER so students can query without teacher-scoped RLS on students. Caller identity must match the student for any meaningful use.';



CREATE OR REPLACE FUNCTION "public"."get_teacher_class_ids"("teacher_uuid" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT id FROM public.classes WHERE teacher_id = teacher_uuid;
$$;


ALTER FUNCTION "public"."get_teacher_class_ids"("teacher_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_teacher_student_ids"("teacher_uuid" "uuid") RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT s.id FROM public.students s
  WHERE s.class_id IN (SELECT id FROM public.classes WHERE teacher_id = teacher_uuid);
$$;


ALTER FUNCTION "public"."get_teacher_student_ids"("teacher_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_learning_path_definition"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE v_status text; v_path_id uuid;
BEGIN
  IF current_user IN ('postgres','supabase_admin','service_role') THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='learning_paths' THEN
    IF TG_OP='UPDATE' AND OLD.status <> 'draft' AND NEW.status='draft' THEN
      RAISE EXCEPTION 'learning_path_not_draft' USING ERRCODE='P0001';
    END IF;
    IF NEW.status='published' AND (TG_OP='INSERT' OR OLD.status='draft') AND NOT EXISTS(
      SELECT 1 FROM public.learning_path_steps WHERE path_id=NEW.id
    ) THEN RAISE EXCEPTION 'learning_path_empty' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND NEW.path_id <> OLD.path_id THEN
    RAISE EXCEPTION 'learning_path_step_move_not_allowed' USING ERRCODE='23514';
  END IF;
  IF TG_OP='DELETE' THEN v_path_id:=OLD.path_id; ELSE v_path_id:=NEW.path_id; END IF;
  SELECT status INTO v_status FROM public.learning_paths WHERE id=v_path_id FOR UPDATE;
  -- A cascading path deletion has already removed its parent.
  IF NOT FOUND AND TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF v_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'learning_path_not_draft' USING ERRCODE='P0001';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_learning_path_definition"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'teacher')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_activity_published"("p_activity_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT status = 'published'
     AND COALESCE(is_published, FALSE)
     AND visibility_scope = 'public'
  FROM public.activities
  WHERE id = p_activity_id;
$$;


ALTER FUNCTION "public"."is_activity_published"("p_activity_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_activity_published"("p_activity_id" "uuid") IS 'Returns true only for public published Activities. Private ready teacher Activities must not leak through public activity_versions RLS.';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_child_artifact_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_action TEXT;
  v_previous JSONB;
  v_new JSONB;
BEGIN
  -- Resolve actor from current session
  v_actor_id := auth.uid();
  SELECT role INTO v_actor_role FROM profiles WHERE id = v_actor_id;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_previous := NULL;
    v_new := jsonb_build_object(
      'visibility', NEW.visibility::text,
      'artifact_type', NEW.artifact_type,
      'student_id', NEW.student_id
    );

    INSERT INTO audit_log (actor_id, actor_role, action, artifact_id, previous_state, new_state)
    VALUES (v_actor_id, COALESCE(v_actor_role, 'unknown'), v_action, NEW.id, v_previous, v_new);

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log visibility changes
    IF OLD.visibility IS DISTINCT FROM NEW.visibility THEN
      IF NEW.visibility = 'family_visible' THEN
        v_action := 'publish';
      ELSE
        v_action := 'visibility_change';
      END IF;

      v_previous := jsonb_build_object('visibility', OLD.visibility::text);
      v_new := jsonb_build_object('visibility', NEW.visibility::text);

      INSERT INTO audit_log (actor_id, actor_role, action, artifact_id, previous_state, new_state)
      VALUES (v_actor_id, COALESCE(v_actor_role, 'unknown'), v_action, NEW.id, v_previous, v_new);
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_previous := jsonb_build_object(
      'visibility', OLD.visibility::text,
      'artifact_type', OLD.artifact_type,
      'student_id', OLD.student_id
    );
    v_new := NULL;

    INSERT INTO audit_log (actor_id, actor_role, action, artifact_id, previous_state, new_state)
    VALUES (v_actor_id, COALESCE(v_actor_role, 'unknown'), v_action, OLD.id, v_previous, v_new);

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_child_artifact_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."make_teacher_activity_ready_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."make_teacher_activity_ready_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."make_teacher_activity_ready_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) IS 'Marks a teacher-owned private Activity ready to assign, validates the current teacher-simple config, and creates/reuses an immutable private activity_versions snapshot including ordered link resources. Service-role only; does not publish to the public catalog.';



CREATE OR REPLACE FUNCTION "public"."notify_linked_parents"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert notification for each active parent link
  INSERT INTO parent_notifications (parent_id, student_id, type, title, message, data)
  SELECT
    pc.parent_id,
    p_student_id,
    p_type,
    p_title,
    p_message,
    p_data
  FROM parent_children pc
  WHERE pc.student_id = p_student_id
    AND pc.status = 'active'
  UNION
  -- Also check students.parent_id for backward compatibility
  SELECT
    s.parent_id,
    p_student_id,
    p_type,
    p_title,
    p_message,
    p_data
  FROM students s
  WHERE s.id = p_student_id
    AND s.parent_id IS NOT NULL
    AND NOT EXISTS (
      -- Avoid duplicates if already in parent_children
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = s.parent_id
        AND pc.student_id = s.id
        AND pc.status = 'active'
    );
END;
$$;


ALTER FUNCTION "public"."notify_linked_parents"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_linked_parents"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb") IS 'Helper function to send notification to all parents linked to a student (both via junction table and legacy parent_id)';



CREATE TABLE IF NOT EXISTS "public"."student_path_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "path_id" "uuid" NOT NULL,
    "current_step_id" "uuid",
    "last_completed_step_id" "uuid",
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_path_progress_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'completed'::"text", 'overridden'::"text"])))
);


ALTER TABLE "public"."student_path_progress" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."override_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_status" "text", "p_current_step_id" "uuid" DEFAULT NULL::"uuid") RETURNS SETOF "public"."student_path_progress"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."override_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_status" "text", "p_current_step_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."override_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_status" "text", "p_current_step_id" "uuid") IS 'Teacher override with explicit role, roster and Assignment checks (including admins whose student reads are hidden by RLS); serializes with advancement and supports reopening.';



CREATE OR REPLACE FUNCTION "public"."profile_preferences_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."profile_preferences_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."publish_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."publish_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) IS 'Publishes an admin/CMS Activity in one transaction and marks it public; teacher-private ready flows must use a separate owner-scoped path.';



CREATE TABLE IF NOT EXISTS "public"."learning_paths" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "age_min" integer,
    "age_max" integer,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "owner_kind" "text" DEFAULT 'teacher'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "learning_paths_check" CHECK ((("age_min" IS NULL) OR ("age_max" IS NULL) OR ("age_min" <= "age_max"))),
    CONSTRAINT "learning_paths_owner_kind_check" CHECK (("owner_kind" = ANY (ARRAY['admin'::"text", 'teacher'::"text"]))),
    CONSTRAINT "learning_paths_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."learning_paths" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_learning_path"("p_path_id" "uuid") RETURNS SETOF "public"."learning_paths"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.learning_paths WHERE id=p_path_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'learning_path_not_found' USING ERRCODE='P0002'; END IF;
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'learning_path_not_draft' USING ERRCODE='P0001'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.learning_path_steps WHERE path_id=p_path_id) THEN
    RAISE EXCEPTION 'learning_path_empty' USING ERRCODE='23514';
  END IF;
  RETURN QUERY UPDATE public.learning_paths SET status='published' WHERE id=p_path_id RETURNING *;
END;
$$;


ALTER FUNCTION "public"."publish_learning_path"("p_path_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "last_version_id" "uuid",
    "status" "text" DEFAULT 'not_started'::"text",
    "score" integer,
    "time_spent" integer,
    "attempts" integer DEFAULT 0,
    "last_played_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "activity_progress_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."activity_progress" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_progress" IS 'Activity-native learner progress keyed by (student_id, activity_id).';



COMMENT ON COLUMN "public"."activity_progress"."last_version_id" IS 'The Activity Version most recently played for this Activity progress row; not part of row identity.';



CREATE OR REPLACE FUNCTION "public"."record_activity_play_session"("p_student_id" "uuid", "p_activity_id" "uuid", "p_session_id" "uuid", "p_sequence" integer, "p_elapsed_seconds" integer, "p_status" "text", "p_version_id" "uuid" DEFAULT NULL::"uuid", "p_score" integer DEFAULT NULL::integer, "p_data" "jsonb" DEFAULT NULL::"jsonb") RETURNS "public"."activity_progress"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_role TEXT;
  v_session public.activity_play_sessions;
  v_progress public.activity_progress;
  v_delta INTEGER;
  v_first BOOLEAN;
BEGIN
  SELECT role::text INTO v_role FROM public.profiles WHERE id = v_actor;
  IF v_actor IS NULL OR NOT (
    (v_role = 'student' AND v_actor = p_student_id)
    OR (v_role = 'teacher' AND p_student_id IN (SELECT public.get_teacher_student_ids(v_actor)))
  ) THEN
    RAISE EXCEPTION 'Not permitted to record learner progress' USING ERRCODE = '42501';
  END IF;
  IF p_session_id IS NULL OR p_sequence IS NULL OR p_sequence < 1
    OR p_elapsed_seconds IS NULL OR p_elapsed_seconds < 0
    OR p_status IS NULL OR p_status NOT IN ('in_progress', 'completed')
    OR p_score < 0 THEN
    RAISE EXCEPTION 'Invalid play session progress' USING ERRCODE = '22023';
  END IF;
  IF p_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.activity_versions WHERE id = p_version_id AND activity_id = p_activity_id
  ) THEN
    RAISE EXCEPTION 'Version does not belong to Activity' USING ERRCODE = '22023';
  END IF;

  -- Serialize both the session cursor and the aggregate across concurrent tabs.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_activity_id::text, 0));
  INSERT INTO public.activity_play_sessions(id, student_id, activity_id, version_id)
    VALUES (p_session_id, p_student_id, p_activity_id, p_version_id) ON CONFLICT DO NOTHING;
  SELECT * INTO v_session FROM public.activity_play_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_session.student_id <> p_student_id OR v_session.activity_id <> p_activity_id
    OR v_session.version_id IS DISTINCT FROM p_version_id THEN
    RAISE EXCEPTION 'Play session context mismatch' USING ERRCODE = '22023';
  END IF;
  IF p_sequence <= v_session.sequence OR v_session.completed THEN
    SELECT * INTO v_progress FROM public.activity_progress
      WHERE student_id = p_student_id AND activity_id = p_activity_id;
    RETURN v_progress;
  END IF;
  v_first := v_session.sequence = 0;
  v_delta := greatest(0, p_elapsed_seconds - v_session.elapsed_seconds);
  UPDATE public.activity_play_sessions SET sequence = p_sequence,
    elapsed_seconds = greatest(elapsed_seconds, p_elapsed_seconds), completed = p_status = 'completed'
    WHERE id = p_session_id;

  INSERT INTO public.activity_progress AS current_progress (
    student_id, activity_id, last_version_id, status, score, attempts, time_spent,
    last_played_at, completed_at, data
  ) VALUES (
    p_student_id, p_activity_id, p_version_id, p_status, p_score, 1, v_delta,
    statement_timestamp(), CASE WHEN p_status = 'completed' THEN statement_timestamp() END, p_data
  ) ON CONFLICT (student_id, activity_id) DO UPDATE SET
    last_version_id = coalesce(EXCLUDED.last_version_id, current_progress.last_version_id),
    status = CASE WHEN current_progress.status = 'completed' THEN 'completed' ELSE EXCLUDED.status END,
    score = CASE WHEN current_progress.status = 'completed' AND p_status <> 'completed'
      THEN current_progress.score ELSE coalesce(EXCLUDED.score, current_progress.score) END,
    attempts = coalesce(current_progress.attempts, 0) + CASE WHEN v_first THEN 1 ELSE 0 END,
    time_spent = coalesce(current_progress.time_spent, 0) + v_delta,
    last_played_at = statement_timestamp(),
    completed_at = coalesce(EXCLUDED.completed_at, current_progress.completed_at),
    data = CASE WHEN current_progress.status = 'completed' AND p_status <> 'completed'
      THEN current_progress.data ELSE coalesce(EXCLUDED.data, current_progress.data) END
  RETURNING * INTO v_progress;
  RETURN v_progress;
END;
$$;


ALTER FUNCTION "public"."record_activity_play_session"("p_student_id" "uuid", "p_activity_id" "uuid", "p_session_id" "uuid", "p_sequence" integer, "p_elapsed_seconds" integer, "p_status" "text", "p_version_id" "uuid", "p_score" integer, "p_data" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "version_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "latest_attempt_id" "uuid",
    "latest_attempt_number" integer DEFAULT 0 NOT NULL,
    "latest_response" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "submitted_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "teacher_feedback" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_submissions_final_response_content" CHECK ((("status" <> ALL (ARRAY['submitted'::"text", 'approved'::"text"])) OR (NULLIF("btrim"(COALESCE(("latest_response" ->> 'text'::"text"), ''::"text")), ''::"text") IS NOT NULL) OR COALESCE((("jsonb_typeof"(("latest_response" -> 'drawing'::"text")) = 'object'::"text") AND (("latest_response" -> 'drawing'::"text") <> '{}'::"jsonb")), false) OR COALESCE((("jsonb_typeof"(("latest_response" -> 'voice'::"text")) = 'object'::"text") AND (("latest_response" -> 'voice'::"text") <> '{}'::"jsonb")), false) OR COALESCE((("jsonb_typeof"(("latest_response" -> 'artifacts'::"text")) = 'array'::"text") AND ("jsonb_array_length"(("latest_response" -> 'artifacts'::"text")) > 0)), false))),
    CONSTRAINT "activity_submissions_latest_attempt_number_check" CHECK (("latest_attempt_number" >= 0)),
    CONSTRAINT "activity_submissions_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text", 'needs_revision'::"text", 'approved'::"text"])))
);


ALTER TABLE "public"."activity_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_submissions" IS 'Current aggregate submission state for a student assignment. One row per student and assignment; attempts preserve history.';



COMMENT ON COLUMN "public"."activity_submissions"."latest_response" IS 'Latest aggregate response payload, copied from the latest submitted/draft attempt for fast review and resume.';



CREATE OR REPLACE FUNCTION "public"."record_activity_submission"("p_assignment_id" "uuid", "p_activity_id" "uuid", "p_version_id" "uuid", "p_intent" "text" DEFAULT 'start'::"text", "p_response" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."activity_submissions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_assignment public.assignments%ROWTYPE;
  v_submission public.activity_submissions%ROWTYPE;
  v_attempt public.activity_submission_attempts%ROWTYPE;
  v_response JSONB := COALESCE(p_response, '{}'::jsonb);
  v_progress_status TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_role IS DISTINCT FROM 'student' THEN
    RAISE EXCEPTION 'only students can record activity submissions' USING ERRCODE = '42501';
  END IF;

  IF p_intent NOT IN ('start', 'submit') THEN
    RAISE EXCEPTION 'invalid submission intent' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_assignment
    FROM public.assignments
   WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment not found' USING ERRCODE = '23503';
  END IF;

  IF v_assignment.activity_id IS DISTINCT FROM p_activity_id THEN
    RAISE EXCEPTION 'assignment does not target this activity' USING ERRCODE = '23514';
  END IF;

  IF v_assignment.version_id IS DISTINCT FROM p_version_id THEN
    RAISE EXCEPTION 'assignment does not target this activity version' USING ERRCODE = '23514';
  END IF;

  IF NOT public.student_can_access_assignment(v_actor_id, p_assignment_id) THEN
    RAISE EXCEPTION 'student is not targeted by assignment' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_submission
    FROM public.activity_submissions
   WHERE assignment_id = p_assignment_id
     AND student_id = v_actor_id
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.activity_submissions (
      assignment_id,
      student_id,
      activity_id,
      version_id,
      latest_response
    ) VALUES (
      p_assignment_id,
      v_actor_id,
      p_activity_id,
      p_version_id,
      v_response
    )
    RETURNING * INTO v_submission;
  END IF;

  IF p_intent = 'start' THEN
    IF v_submission.status NOT IN ('draft', 'needs_revision') THEN
      RETURN v_submission;
    END IF;

    SELECT * INTO v_attempt
      FROM public.activity_submission_attempts
     WHERE submission_id = v_submission.id
       AND status = 'draft'
     ORDER BY attempt_number DESC
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
      IF v_submission.status = 'needs_revision' THEN
        v_response := v_submission.latest_response;
      END IF;

      INSERT INTO public.activity_submission_attempts (
        submission_id,
        attempt_number,
        response
      ) VALUES (
        v_submission.id,
        v_submission.latest_attempt_number + 1,
        v_response
      )
      RETURNING * INTO v_attempt;
    ELSE
      UPDATE public.activity_submission_attempts
         SET response = v_response
       WHERE id = v_attempt.id
       RETURNING * INTO v_attempt;
    END IF;

    UPDATE public.activity_submissions
       SET status = 'draft',
           latest_response = v_attempt.response,
           reviewed_by = NULL,
           reviewed_at = NULL,
           teacher_feedback = NULL
     WHERE id = v_submission.id
     RETURNING * INTO v_submission;

    v_progress_status := 'in_progress';
  ELSE
    IF v_submission.status = 'approved' THEN
      RAISE EXCEPTION 'submission already approved' USING ERRCODE = '23514';
    END IF;

    IF v_submission.status = 'submitted' THEN
      RAISE EXCEPTION 'submission already awaiting review' USING ERRCODE = '23505';
    END IF;

    SELECT * INTO v_attempt
      FROM public.activity_submission_attempts
     WHERE submission_id = v_submission.id
       AND status = 'draft'
     ORDER BY attempt_number DESC
     LIMIT 1
     FOR UPDATE;

    IF NOT FOUND THEN
      INSERT INTO public.activity_submission_attempts (
        submission_id,
        attempt_number,
        response
      ) VALUES (
        v_submission.id,
        v_submission.latest_attempt_number + 1,
        v_response
      )
      RETURNING * INTO v_attempt;
    ELSE
      UPDATE public.activity_submission_attempts
         SET response = v_response
       WHERE id = v_attempt.id
       RETURNING * INTO v_attempt;
    END IF;

    UPDATE public.activity_submission_attempts
       SET status = 'submitted', response = v_response
     WHERE id = v_attempt.id
     RETURNING * INTO v_attempt;

    UPDATE public.activity_submissions
       SET status = 'submitted',
           latest_attempt_id = v_attempt.id,
           latest_attempt_number = v_attempt.attempt_number,
           latest_response = v_attempt.response,
           reviewed_by = NULL,
           reviewed_at = NULL,
           teacher_feedback = NULL
     WHERE id = v_submission.id
     RETURNING * INTO v_submission;

    v_progress_status := 'completed';
  END IF;

  INSERT INTO public.activity_progress (
    student_id,
    activity_id,
    last_version_id,
    status,
    attempts,
    last_played_at,
    completed_at
  ) VALUES (
    v_actor_id,
    p_activity_id,
    p_version_id,
    v_progress_status,
    CASE WHEN v_progress_status = 'completed' THEN v_submission.latest_attempt_number ELSE 0 END,
    NOW(),
    CASE WHEN v_progress_status = 'completed' THEN NOW() ELSE NULL END
  )
  ON CONFLICT (student_id, activity_id) DO UPDATE
  SET last_version_id = EXCLUDED.last_version_id,
      status = EXCLUDED.status,
      attempts = GREATEST(COALESCE(public.activity_progress.attempts, 0), EXCLUDED.attempts),
      last_played_at = EXCLUDED.last_played_at,
      completed_at = COALESCE(public.activity_progress.completed_at, EXCLUDED.completed_at),
      updated_at = NOW();

  RETURN v_submission;
END;
$$;


ALTER FUNCTION "public"."record_activity_submission"("p_assignment_id" "uuid", "p_activity_id" "uuid", "p_version_id" "uuid", "p_intent" "text", "p_response" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_activity_version_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RAISE EXCEPTION 'activity_versions rows are immutable; insert a new version_number instead';
END;
$$;


ALTER FUNCTION "public"."reject_activity_version_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_learning_path_steps"("p_path_id" "uuid", "p_ordered_step_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "step_order" integer)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_path_status TEXT;
  v_existing_count INT;
  v_matched_count INT;
  v_input_count INT;
  v_distinct_input_count INT;
  v_max_step_order INT;
  v_temp_step_order_offset INT;
BEGIN
  IF p_path_id IS NULL OR p_ordered_step_ids IS NULL THEN
    RAISE EXCEPTION 'learning_path_step_mismatch'
      USING ERRCODE = '22023';
  END IF;

  SELECT lp.status
  INTO v_path_status
  FROM public.learning_paths lp
  WHERE lp.id = p_path_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'learning_path_not_found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_path_status <> 'draft' THEN
    RAISE EXCEPTION 'learning_path_not_draft'
      USING ERRCODE = 'P0001';
  END IF;

  v_input_count := cardinality(p_ordered_step_ids);

  SELECT COUNT(DISTINCT input_step_id)::INT
  INTO v_distinct_input_count
  FROM unnest(p_ordered_step_ids) AS ordered_input(input_step_id);

  SELECT
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE lps.id = ANY(p_ordered_step_ids))::INT,
    COALESCE(MAX(lps.step_order), -1)
  INTO v_existing_count, v_matched_count, v_max_step_order
  FROM public.learning_path_steps lps
  WHERE lps.path_id = p_path_id;

  IF v_input_count <> v_distinct_input_count
    OR v_input_count <> v_existing_count
    OR v_matched_count <> v_existing_count THEN
    RAISE EXCEPTION 'learning_path_step_mismatch'
      USING ERRCODE = '22023';
  END IF;

  v_temp_step_order_offset := v_max_step_order + v_input_count + 1;

  WITH ordered_steps AS (
    SELECT
      ordered_input.step_id,
      v_temp_step_order_offset + ordered_input.ordinality::INT - 1 AS temp_step_order
    FROM unnest(p_ordered_step_ids) WITH ORDINALITY AS ordered_input(step_id, ordinality)
  )
  UPDATE public.learning_path_steps lps
  SET step_order = ordered_steps.temp_step_order
  FROM ordered_steps
  WHERE lps.path_id = p_path_id
    AND lps.id = ordered_steps.step_id;

  WITH ordered_steps AS (
    SELECT
      ordered_input.step_id,
      ordered_input.ordinality::INT - 1 AS final_step_order
    FROM unnest(p_ordered_step_ids) WITH ORDINALITY AS ordered_input(step_id, ordinality)
  )
  UPDATE public.learning_path_steps lps
  SET step_order = ordered_steps.final_step_order
  FROM ordered_steps
  WHERE lps.path_id = p_path_id
    AND lps.id = ordered_steps.step_id;

  RETURN QUERY
  SELECT lps.id, lps.step_order
  FROM public.learning_path_steps lps
  WHERE lps.path_id = p_path_id
  ORDER BY lps.step_order ASC;
END;
$$;


ALTER FUNCTION "public"."reorder_learning_path_steps"("p_path_id" "uuid", "p_ordered_step_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."restore_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current public.activities%ROWTYPE;
  v_activity public.activities%ROWTYPE;
  v_restored_status TEXT;
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
    RAISE EXCEPTION 'teachers can only restore private owned activities' USING ERRCODE = '42501';
  END IF;

  IF v_current.status IS DISTINCT FROM 'archived' THEN
    RAISE EXCEPTION 'activity % is not archived', p_activity_id USING ERRCODE = '42501';
  END IF;

  v_restored_status := CASE
    WHEN COALESCE(v_current.is_published, FALSE) THEN 'published'
    ELSE 'draft'
  END;

  UPDATE public.activities
     SET status = v_restored_status,
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
    'teacher_activity_restore',
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


ALTER FUNCTION "public"."restore_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."restore_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") IS 'Restores a teacher-owned private archived Activity to draft or ready status based on is_published, without mutating versions, assignments, submissions, resources, or family-share metadata. Service-role only.';



CREATE OR REPLACE FUNCTION "public"."retry_native_activity_progress"("p_student_id" "uuid", "p_submission_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."retry_native_activity_progress"("p_student_id" "uuid", "p_submission_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revert_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."revert_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."revert_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) IS 'Restores a CMS activity draft from a historical activity_versions snapshot and writes the admin audit log in the same transaction.';



CREATE OR REPLACE FUNCTION "public"."review_activity_submission"("p_submission_id" "uuid", "p_decision" "text", "p_teacher_feedback" "text" DEFAULT NULL::"text", "p_family_comment" "text" DEFAULT NULL::"text") RETURNS "public"."activity_submissions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_submission public.activity_submissions%ROWTYPE;
  v_attempt public.activity_submission_attempts%ROWTYPE;
  v_feedback TEXT := NULLIF(BTRIM(COALESCE(p_teacher_feedback, '')), '');
  v_family_comment TEXT := NULLIF(BTRIM(COALESCE(p_family_comment, '')), '');
  v_family_share_eligible BOOLEAN := FALSE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_actor_role FROM public.profiles WHERE id = v_actor_id;
  IF v_actor_role IS DISTINCT FROM 'teacher' THEN
    RAISE EXCEPTION 'only teachers can review activity submissions' USING ERRCODE = '42501';
  END IF;

  IF p_decision NOT IN ('needs_revision', 'approved') THEN
    RAISE EXCEPTION 'invalid review decision' USING ERRCODE = '23514';
  END IF;

  IF p_decision = 'needs_revision' AND v_feedback IS NULL THEN
    RAISE EXCEPTION 'revision feedback is required' USING ERRCODE = '23514';
  END IF;

  SELECT s.* INTO v_submission
    FROM public.activity_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
   WHERE s.id = p_submission_id
     AND a.teacher_id = v_actor_id
   FOR UPDATE OF s;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'submission not found for this teacher' USING ERRCODE = '42501';
  END IF;

  IF v_submission.status <> 'submitted' THEN
    RAISE EXCEPTION 'only submitted work can be reviewed' USING ERRCODE = '23514';
  END IF;

  IF v_submission.latest_attempt_id IS NULL THEN
    RAISE EXCEPTION 'submitted work is missing its latest attempt' USING ERRCODE = '23514';
  END IF;

  v_family_share_eligible := p_decision = 'approved'
    AND public.activity_version_shares_with_family(v_submission.version_id);

  UPDATE public.activity_submission_attempts
     SET review_status = p_decision,
         reviewed_by = v_actor_id,
         reviewed_at = NOW(),
         teacher_feedback = CASE WHEN p_decision = 'needs_revision' THEN v_feedback ELSE NULL END
   WHERE id = v_submission.latest_attempt_id
     AND submission_id = v_submission.id
     AND status = 'submitted'
   RETURNING * INTO v_attempt;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'latest submitted attempt not found' USING ERRCODE = '23514';
  END IF;

  UPDATE public.activity_submissions
     SET status = p_decision,
         reviewed_by = v_actor_id,
         reviewed_at = v_attempt.reviewed_at,
         teacher_feedback = v_attempt.teacher_feedback
   WHERE id = v_submission.id
   RETURNING * INTO v_submission;

  IF v_family_share_eligible THEN
    INSERT INTO public.activity_submission_family_shares (attempt_id, submission_id, family_comment)
    VALUES (v_attempt.id, v_submission.id, v_family_comment)
    ON CONFLICT (attempt_id) DO UPDATE
    SET family_comment = EXCLUDED.family_comment,
        updated_at = NOW();
  ELSE
    DELETE FROM public.activity_submission_family_shares
     WHERE attempt_id = v_attempt.id;
  END IF;

  RETURN v_submission;
END;
$$;


ALTER FUNCTION "public"."review_activity_submission"("p_submission_id" "uuid", "p_decision" "text", "p_teacher_feedback" "text", "p_family_comment" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."review_activity_submission"("p_submission_id" "uuid", "p_decision" "text", "p_teacher_feedback" "text", "p_family_comment" "text") IS 'Applies an owning teacher review decision to the latest submitted free-response attempt, including approval-time family sharing metadata.';



CREATE OR REPLACE FUNCTION "public"."save_teacher_activity_draft"("p_draft" "jsonb", "p_activity_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."save_teacher_activity_draft"("p_draft" "jsonb", "p_activity_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_child_consent"("p_child_id" "uuid", "p_consent_key" "text", "p_value" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_link_count INT;
  v_caller_role TEXT;
BEGIN
  -- Mirror the TS ConsentKey union — reject keys we don't recognize so a
  -- typo doesn't quietly grow the consent map.
  IF p_consent_key NOT IN ('audio_recording', 'photo_capture', 'video_capture') THEN
    RAISE EXCEPTION 'Cheia de consimtamant nu este recunoscuta: %', p_consent_key
      USING ERRCODE = 'check_violation';
  END IF;

  -- Caller must be a parent profile, not merely any authenticated user with
  -- a parent_children row.
  SELECT role INTO v_caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION 'Doar parintii pot modifica consimtamantul copilului'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Caller must also be the active parent for this child. The audit trigger
  -- on `students` records auth.uid() (the parent), so audit attribution is
  -- correct even though this function is SECURITY DEFINER.
  SELECT COUNT(*) INTO v_link_count
  FROM parent_children
  WHERE parent_id = auth.uid()
    AND student_id = p_child_id
    AND status = 'active';

  IF v_link_count = 0 THEN
    RAISE EXCEPTION 'Nu ai permisiunea sa modifici consimtamantul pentru acest copil'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('eduplay.allow_child_consent_update', 'on', true);

  UPDATE students
  SET consents = jsonb_set(
        coalesce(consents, '{}'::jsonb),
        ARRAY[p_consent_key],
        to_jsonb(p_value),
        TRUE
      ),
      updated_at = NOW()
  WHERE id = p_child_id;

  PERFORM set_config('eduplay.allow_child_consent_update', 'off', true);
END;
$$;


ALTER FUNCTION "public"."set_child_consent"("p_child_id" "uuid", "p_consent_key" "text", "p_value" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_child_consent"("p_child_id" "uuid", "p_consent_key" "text", "p_value" boolean) IS 'Parent-only RPC that flips a single consent flag on the child profile. Gated on an active parent_children link.';



CREATE OR REPLACE FUNCTION "public"."should_notify_parent"("p_parent_id" "uuid", "p_notification_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  prefs RECORD;
  check_time TIME;
BEGIN
  -- Get parent preferences (with defaults if not exists)
  SELECT
    COALESCE(game_completed, TRUE) AS game_completed,
    COALESCE(milestone, TRUE) AS milestone,
    COALESCE(weekly_summary, TRUE) AS weekly_summary,
    COALESCE(achievement, TRUE) AS achievement,
    COALESCE(assignment_due, TRUE) AS assignment_due,
    COALESCE(assignment_completed, TRUE) AS assignment_completed,
    quiet_hours_start,
    quiet_hours_end
  INTO prefs
  FROM parent_notification_preferences
  WHERE parent_id = p_parent_id;

  -- If no preferences found, default to TRUE
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Check quiet hours
  check_time := LOCALTIME;
  IF prefs.quiet_hours_start IS NOT NULL AND prefs.quiet_hours_end IS NOT NULL THEN
    IF prefs.quiet_hours_start < prefs.quiet_hours_end THEN
      -- Normal case: 22:00 - 07:00
      IF check_time >= prefs.quiet_hours_start AND check_time <= prefs.quiet_hours_end THEN
        RETURN FALSE;
      END IF;
    ELSE
      -- Wraps midnight: 22:00 - 07:00
      IF check_time >= prefs.quiet_hours_start OR check_time <= prefs.quiet_hours_end THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;

  -- Check notification type preference
  RETURN CASE p_notification_type
    WHEN 'game_completed' THEN prefs.game_completed
    WHEN 'milestone' THEN prefs.milestone
    WHEN 'weekly_summary' THEN prefs.weekly_summary
    WHEN 'achievement' THEN prefs.achievement
    WHEN 'assignment_due' THEN prefs.assignment_due
    WHEN 'assignment_completed' THEN prefs.assignment_completed
    ELSE TRUE
  END;
END;
$$;


ALTER FUNCTION "public"."should_notify_parent"("p_parent_id" "uuid", "p_notification_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."should_notify_parent"("p_parent_id" "uuid", "p_notification_type" "text") IS 'Check if parent wants to receive a specific notification type (respects preferences and quiet hours)';



CREATE OR REPLACE FUNCTION "public"."student_can_access_assignment"("p_student_id" "uuid", "p_assignment_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.assignments a
      JOIN public.students s ON s.id = p_student_id
     WHERE a.id = p_assignment_id
       AND (
         a.student_id = p_student_id
         OR (a.class_id IS NOT NULL AND s.class_id = a.class_id)
       )
  );
$$;


ALTER FUNCTION "public"."student_can_access_assignment"("p_student_id" "uuid", "p_assignment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."teacher_can_review_submission"("p_teacher_id" "uuid", "p_submission_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.activity_submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      JOIN public.profiles p ON p.id = p_teacher_id
     WHERE s.id = p_submission_id
       AND a.teacher_id = p_teacher_id
       AND p.role = 'teacher'
  );
$$;


ALTER FUNCTION "public"."teacher_can_review_submission"("p_teacher_id" "uuid", "p_submission_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."teacher_owns_assignment_target"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_student_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id = p_teacher_id
       AND role = 'teacher'
  )
  AND (
    (
      p_class_id IS NOT NULL
      AND p_student_id IS NULL
      AND EXISTS (
        SELECT 1
          FROM public.classes
         WHERE id = p_class_id
           AND teacher_id = p_teacher_id
      )
    )
    OR
    (
      p_class_id IS NULL
      AND p_student_id IS NOT NULL
      AND EXISTS (
        SELECT 1
          FROM public.students
          JOIN public.classes ON classes.id = students.class_id
         WHERE students.id = p_student_id
           AND classes.teacher_id = p_teacher_id
      )
    )
  );
$$;


ALTER FUNCTION "public"."teacher_owns_assignment_target"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_student_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."teacher_owns_assignment_target"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_student_id" "uuid") IS 'Checks that an assignment target belongs to the teacher roster before RLS allows inserts or target-changing updates.';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "thumbnail_url" "text",
    "default_lang" "text" DEFAULT 'ro'::"text" NOT NULL,
    "default_theme" "text",
    "category" "text",
    "difficulty" "text" DEFAULT 'easy'::"text",
    "target_age_min" integer,
    "target_age_max" integer,
    "estimated_duration" integer,
    "question_count" integer,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "subject" "text",
    "skills" "text"[] DEFAULT '{}'::"text"[],
    "is_published" boolean DEFAULT false,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "config_data" "jsonb",
    "config_schema_version" integer,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "visibility_scope" "text" DEFAULT 'private'::"text" NOT NULL,
    CONSTRAINT "activities_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"]))),
    CONSTRAINT "activities_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_review'::"text", 'published'::"text", 'archived'::"text"]))),
    CONSTRAINT "activities_visibility_scope_check" CHECK (("visibility_scope" = ANY (ARRAY['private'::"text", 'school'::"text", 'public'::"text"])))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."activities"."config_data" IS 'Live editor draft of the activity config. Validated server-side against activity_types.config_schema. Nullable until EDU-30.B migrates legacy per-template tables.';



COMMENT ON COLUMN "public"."activities"."config_schema_version" IS 'activity_types.version pinned at the time the row was last edited; lets the server detect stale drafts after a schema bump.';



COMMENT ON COLUMN "public"."activities"."status" IS 'CMS lifecycle state. Authoritative for CMS UI. Legacy is_published boolean remains until EDU-30.B reconciles content.';



COMMENT ON COLUMN "public"."activities"."visibility_scope" IS 'Discovery scope for first-class Activities. private teacher Activities can be ready/assigned without becoming public catalog content; school/public are reserved for broader sharing.';



CREATE TABLE IF NOT EXISTS "public"."activity_days" (
    "student_id" "uuid" NOT NULL,
    "active_day" "date" NOT NULL
);


ALTER TABLE "public"."activity_days" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_days" IS 'Observed saved learner engagement in Europe/Bucharest. Historical coverage before this migration may be incomplete.';



CREATE TABLE IF NOT EXISTS "public"."activity_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type_id" "text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "assigned_to" "uuid" NOT NULL,
    "class_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "result_summary" "jsonb",
    "source_learning_path_step_id" "uuid"
);


ALTER TABLE "public"."activity_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_play_sessions" (
    "id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "version_id" "uuid",
    "sequence" integer DEFAULT 0 NOT NULL,
    "elapsed_seconds" integer DEFAULT 0 NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    CONSTRAINT "activity_play_sessions_elapsed_seconds_check" CHECK (("elapsed_seconds" >= 0)),
    CONSTRAINT "activity_play_sessions_sequence_check" CHECK (("sequence" >= 0))
);


ALTER TABLE "public"."activity_play_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_preview_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "type_id" "text" NOT NULL,
    "config_data" "jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_preview_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_preview_sessions" IS 'Short-lived opaque CMS draft preview sessions. Stores draft config server-side so iframe URLs never carry unpublished JSON payloads.';



CREATE TABLE IF NOT EXISTS "public"."activity_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "version_id" "uuid",
    "resource_type" "text" DEFAULT 'link'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_resources_resource_type_check" CHECK (("resource_type" = 'link'::"text")),
    CONSTRAINT "activity_resources_sort_order_check" CHECK ((("sort_order" > 0) AND ("sort_order" <= 20))),
    CONSTRAINT "activity_resources_title_check" CHECK ((("btrim"("title") <> ''::"text") AND ("char_length"("title") <= 160))),
    CONSTRAINT "activity_resources_url_check" CHECK (("url" ~* '^https?://.+'::"text"))
);


ALTER TABLE "public"."activity_resources" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_resources" IS 'Ordered teacher-provided resources for Activities. version_id NULL rows are editable live resources; version_id rows are immutable snapshots for assigned versions.';



CREATE TABLE IF NOT EXISTS "public"."activity_submission_attempts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "attempt_number" integer NOT NULL,
    "response" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "submitted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "review_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "teacher_feedback" "text",
    CONSTRAINT "activity_submission_attempts_attempt_number_check" CHECK (("attempt_number" >= 1)),
    CONSTRAINT "activity_submission_attempts_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending'::"text", 'needs_revision'::"text", 'approved'::"text"]))),
    CONSTRAINT "activity_submission_attempts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'submitted'::"text"]))),
    CONSTRAINT "activity_submission_attempts_submitted_response_content" CHECK ((("status" <> 'submitted'::"text") OR (NULLIF("btrim"(COALESCE(("response" ->> 'text'::"text"), ''::"text")), ''::"text") IS NOT NULL) OR COALESCE((("jsonb_typeof"(("response" -> 'drawing'::"text")) = 'object'::"text") AND (("response" -> 'drawing'::"text") <> '{}'::"jsonb")), false) OR COALESCE((("jsonb_typeof"(("response" -> 'voice'::"text")) = 'object'::"text") AND (("response" -> 'voice'::"text") <> '{}'::"jsonb")), false) OR COALESCE((("jsonb_typeof"(("response" -> 'artifacts'::"text")) = 'array'::"text") AND ("jsonb_array_length"(("response" -> 'artifacts'::"text")) > 0)), false)))
);


ALTER TABLE "public"."activity_submission_attempts" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_submission_attempts" IS 'Immutable-on-submit free-response attempt history. Draft attempts can be edited until submitted.';



COMMENT ON COLUMN "public"."activity_submission_attempts"."review_status" IS 'Teacher review status for a submitted attempt. Draft attempts remain pending until submitted.';



COMMENT ON COLUMN "public"."activity_submission_attempts"."teacher_feedback" IS 'Student-facing feedback captured when a teacher requests revision for this attempt.';



CREATE TABLE IF NOT EXISTS "public"."activity_submission_family_shares" (
    "attempt_id" "uuid" NOT NULL,
    "submission_id" "uuid" NOT NULL,
    "family_comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_submission_family_shares" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_submission_family_shares" IS 'Private family-sharing metadata for approved free-response attempts. Row existence records approval-time family-share eligibility.';



COMMENT ON COLUMN "public"."activity_submission_family_shares"."family_comment" IS 'Optional family-facing approval note. Separate from student-facing teacher_feedback and not readable by student RLS policies.';



CREATE TABLE IF NOT EXISTS "public"."activity_types" (
    "type_id" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "config_schema" "jsonb" NOT NULL,
    "renderer_key" "text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "renderer_kind" "text" DEFAULT 'iframe'::"text" NOT NULL,
    "authoring_mode" "text" DEFAULT 'admin-only'::"text" NOT NULL,
    "produces_submission" boolean DEFAULT false NOT NULL,
    "supports_review" boolean DEFAULT false NOT NULL,
    "is_auto_scored" boolean DEFAULT true NOT NULL,
    CONSTRAINT "activity_types_authoring_mode_check" CHECK (("authoring_mode" = ANY (ARRAY['admin-only'::"text", 'teacher-simple'::"text", 'hidden'::"text"]))),
    CONSTRAINT "activity_types_renderer_kind_check" CHECK (("renderer_kind" = ANY (ARRAY['iframe'::"text", 'react'::"text"]))),
    CONSTRAINT "activity_types_type_id_check" CHECK (("type_id" ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'::"text")),
    CONSTRAINT "activity_types_version_check" CHECK (("version" >= 1))
);


ALTER TABLE "public"."activity_types" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_types" IS 'Registry of activity templates. Each row binds a kebab-case type_id to its config JSON Schema (draft-2020-12) and the runtime renderer key.';



COMMENT ON COLUMN "public"."activity_types"."config_schema" IS 'JSON Schema (draft-2020-12) used to validate activity.config_data on the server.';



COMMENT ON COLUMN "public"."activity_types"."version" IS 'Schema version. Bump when config_schema changes in a way that requires migrating existing activities. Activities pin their schema version via activities.config_schema_version.';



COMMENT ON COLUMN "public"."activity_types"."renderer_kind" IS 'Renderer surface for the player shell. iframe renderers are Phaser templates; react renderers are native app activities.';



COMMENT ON COLUMN "public"."activity_types"."authoring_mode" IS 'Controls whether a type is authorable by teachers, admins only, or hidden from authoring surfaces.';



COMMENT ON COLUMN "public"."activity_types"."produces_submission" IS 'Whether this type creates student submission/review records rather than only progress telemetry.';



COMMENT ON COLUMN "public"."activity_types"."supports_review" IS 'Whether teacher review actions apply to submissions produced by this type.';



COMMENT ON COLUMN "public"."activity_types"."is_auto_scored" IS 'Whether completion/progress is automatically scored by the renderer.';



CREATE TABLE IF NOT EXISTS "public"."activity_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "config_data" "jsonb" NOT NULL,
    "config_schema_version" integer NOT NULL,
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_by_user_id" "uuid",
    "activity_type_id" "text" NOT NULL,
    CONSTRAINT "activity_versions_version_number_check" CHECK (("version_number" >= 1))
);


ALTER TABLE "public"."activity_versions" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_versions" IS 'Immutable snapshot of an activity at publish time. Assignments and learner sessions pin to a specific version_id so subsequent edits never alter what a learner already saw.';



COMMENT ON COLUMN "public"."activity_versions"."config_schema_version" IS 'Snapshot of activity_types.version at publish time. Used by the player to load the matching renderer compat layer.';



COMMENT ON COLUMN "public"."activity_versions"."activity_type_id" IS 'Renderer pin for the snapshot. Resolved through activity_types.renderer_key by the player so a published version is renderer-stable even if activities.template is later edited. Set on insert; immutable via the existing activity_versions immutability trigger.';



CREATE TABLE IF NOT EXISTS "public"."assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "class_id" "uuid",
    "student_id" "uuid",
    "due_date" timestamp with time zone,
    "is_mandatory" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version_id" "uuid" NOT NULL,
    "activity_id" "uuid" NOT NULL,
    CONSTRAINT "assignments_exactly_one_target" CHECK (("num_nonnulls"("class_id", "student_id") = 1))
);


ALTER TABLE "public"."assignments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."assignments"."version_id" IS 'Required immutable Activity Version pin for this assignment.';



COMMENT ON COLUMN "public"."assignments"."activity_id" IS 'Canonical Activity target for this assignment.';



COMMENT ON CONSTRAINT "assignments_exactly_one_target" ON "public"."assignments" IS 'Assignments target either one class or one student, never both; selected-student assignments are represented as one row per student.';



CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "actor_role" "text" NOT NULL,
    "action" "text" NOT NULL,
    "artifact_id" "uuid" NOT NULL,
    "artifact_table" "text" DEFAULT 'child_artifacts'::"text" NOT NULL,
    "previous_state" "jsonb",
    "new_state" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "audit_log_action_check" CHECK (("action" = ANY (ARRAY['publish'::"text", 'delete'::"text", 'visibility_change'::"text", 'create'::"text"])))
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" bigint NOT NULL,
    "table_name" "text" NOT NULL,
    "record_id" "uuid",
    "operation" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action" "text",
    "visibility" "text",
    "resource_id_text" "text",
    CONSTRAINT "audit_logs_admin_row_has_action" CHECK ((("operation" IS NOT NULL) OR ("action" IS NOT NULL))),
    CONSTRAINT "audit_logs_operation_check" CHECK ((("operation" IS NULL) OR ("operation" = ANY (ARRAY['INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))),
    CONSTRAINT "audit_logs_resource_id_present" CHECK ((("record_id" IS NOT NULL) OR ("resource_id_text" IS NOT NULL)))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."audit_logs"."action" IS 'High-level action label for admin-driven mutations (e.g. flag_enabled, user_suspended). Null for trigger-generated rows.';



COMMENT ON COLUMN "public"."audit_logs"."visibility" IS 'Audit visibility scope: ''platform'', ''family'', ''internal''. Null for trigger-generated rows.';



COMMENT ON COLUMN "public"."audit_logs"."resource_id_text" IS 'Text-keyed resource id for resources whose primary key is not a UUID (e.g. feature_flags.name).';



ALTER TABLE "public"."audit_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."auth_rate_limit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "identifier" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."auth_rate_limit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."child_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "class_id" "uuid",
    "title" "text",
    "artifact_type" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "visibility" "public"."visibility_status" DEFAULT 'draft'::"public"."visibility_status" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "child_artifacts_artifact_type_check" CHECK (("artifact_type" = ANY (ARRAY['drawing'::"text", 'photo'::"text", 'audio'::"text", 'video'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."child_artifacts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."child_artifacts"."metadata" IS 'Activity artifact metadata such as activityId, versionId, assignmentId, and score.';



CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "grade_level" "text",
    "school_year" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "classes_grade_level_check" CHECK (("grade_level" = ANY (ARRAY['preschool'::"text", 'kindergarten'::"text", 'grade-1'::"text", 'grade-2'::"text"])))
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reason" "text",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scheduled_deletion_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "cancelled_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'cancelled'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."deletion_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."deletion_requests" IS 'GDPR Art.17 erasure requests with 30-day grace period. Users can cancel during the window.';



CREATE TABLE IF NOT EXISTS "public"."feature_flag_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "flag_name" "text" NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "before" "jsonb",
    "after" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feature_flag_events_action_check" CHECK (("action" = ANY (ARRAY['created'::"text", 'enabled'::"text", 'disabled'::"text", 'targeting_changed'::"text", 'description_changed'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."feature_flag_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "name" "text" NOT NULL,
    "description" "text",
    "enabled" boolean DEFAULT false NOT NULL,
    "targeting" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."learning_path_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "path_id" "uuid" NOT NULL,
    "class_id" "uuid",
    "student_id" "uuid",
    "assigned_by" "uuid" NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "learning_path_assignments_check" CHECK ((("class_id" IS NULL) <> ("student_id" IS NULL)))
);


ALTER TABLE "public"."learning_path_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."native_activity_submission_targets" (
    "submission_id" "uuid" NOT NULL,
    "step_id" "uuid" NOT NULL,
    "settled" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."native_activity_submission_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parent_children" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "relationship_type" "text" DEFAULT 'guardian'::"text" NOT NULL,
    "linked_at" timestamp with time zone DEFAULT "now"(),
    "linked_via_code" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "parent_children_relationship_type_check" CHECK (("relationship_type" = ANY (ARRAY['mother'::"text", 'father'::"text", 'guardian'::"text", 'other'::"text"]))),
    CONSTRAINT "parent_children_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."parent_children" OWNER TO "postgres";


COMMENT ON TABLE "public"."parent_children" IS 'Junction table enabling multiple parents per student (e.g., divorced parents, guardians). Replaces single parent_id foreign key in students table.';



COMMENT ON COLUMN "public"."parent_children"."relationship_type" IS 'Type of relationship: mother, father, guardian, or other';



COMMENT ON COLUMN "public"."parent_children"."linked_via_code" IS 'Foreign key to parent_invite_codes if linked via invite code';



COMMENT ON COLUMN "public"."parent_children"."status" IS 'Status of link: active or revoked';



CREATE TABLE IF NOT EXISTS "public"."parent_invite_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code_hash" "text" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "teacher_id" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    "is_revoked" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_expiry" CHECK (("expires_at" > "created_at"))
);


ALTER TABLE "public"."parent_invite_codes" OWNER TO "postgres";


COMMENT ON TABLE "public"."parent_invite_codes" IS 'Secure invite codes for parent-child linking. Codes are hashed (bcrypt) and expire after 7 days.';



COMMENT ON COLUMN "public"."parent_invite_codes"."code_hash" IS 'bcrypt hash of the 8-character invite code (never store plain text)';



COMMENT ON COLUMN "public"."parent_invite_codes"."expires_at" IS 'Expiration timestamp (default: 7 days from creation)';



COMMENT ON COLUMN "public"."parent_invite_codes"."used_at" IS 'Timestamp when code was used to link parent to child';



COMMENT ON COLUMN "public"."parent_invite_codes"."used_by" IS 'Parent profile ID who used this code';



COMMENT ON COLUMN "public"."parent_invite_codes"."is_revoked" IS 'Whether code was manually revoked by teacher before use';



CREATE TABLE IF NOT EXISTS "public"."parent_notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "game_completed" boolean DEFAULT true,
    "milestone" boolean DEFAULT true,
    "weekly_summary" boolean DEFAULT true,
    "achievement" boolean DEFAULT true,
    "assignment_due" boolean DEFAULT true,
    "assignment_completed" boolean DEFAULT true,
    "email_notifications" boolean DEFAULT false,
    "push_notifications" boolean DEFAULT false,
    "digest_frequency" "text" DEFAULT 'realtime'::"text",
    "quiet_hours_start" time without time zone,
    "quiet_hours_end" time without time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "parent_notification_preferences_digest_frequency_check" CHECK (("digest_frequency" = ANY (ARRAY['realtime'::"text", 'daily'::"text", 'weekly'::"text"])))
);


ALTER TABLE "public"."parent_notification_preferences" OWNER TO "postgres";


COMMENT ON TABLE "public"."parent_notification_preferences" IS 'Parent notification preferences for customizing which notifications they receive. Default preferences created automatically on parent signup.';



COMMENT ON COLUMN "public"."parent_notification_preferences"."game_completed" IS 'Notify when child completes a game';



COMMENT ON COLUMN "public"."parent_notification_preferences"."milestone" IS 'Notify when child reaches a learning milestone';



COMMENT ON COLUMN "public"."parent_notification_preferences"."weekly_summary" IS 'Send weekly progress summary';



COMMENT ON COLUMN "public"."parent_notification_preferences"."achievement" IS 'Notify when child earns an achievement';



COMMENT ON COLUMN "public"."parent_notification_preferences"."assignment_due" IS 'Notify when assignment is due soon';



COMMENT ON COLUMN "public"."parent_notification_preferences"."assignment_completed" IS 'Notify when child completes an assignment';



COMMENT ON COLUMN "public"."parent_notification_preferences"."digest_frequency" IS 'How often to send notifications: realtime, daily, or weekly';



COMMENT ON COLUMN "public"."parent_notification_preferences"."quiet_hours_start" IS 'Start time for quiet hours (no notifications)';



COMMENT ON COLUMN "public"."parent_notification_preferences"."quiet_hours_end" IS 'End time for quiet hours';



CREATE TABLE IF NOT EXISTS "public"."parent_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "parent_notifications_type_check" CHECK (("type" = ANY (ARRAY['game_completed'::"text", 'milestone'::"text", 'weekly_summary'::"text", 'achievement'::"text", 'assignment_due'::"text", 'assignment_completed'::"text", 'artifact_published'::"text"])))
);


ALTER TABLE "public"."parent_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."parent_notifications" IS 'In-app notifications for parents about their children''s progress. Supports real-time updates via Supabase Realtime.';



COMMENT ON COLUMN "public"."parent_notifications"."type" IS 'Notification type: game_completed, milestone, weekly_summary, achievement, assignment_due, assignment_completed, artifact_published';



COMMENT ON COLUMN "public"."parent_notifications"."data" IS 'Additional structured data (JSONB): game_id, score, time_spent, achievement_id, etc.';



COMMENT ON COLUMN "public"."parent_notifications"."read_at" IS 'Timestamp when notification was marked as read (NULL = unread)';



CREATE TABLE IF NOT EXISTS "public"."password_reset_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ip_address" "text",
    "user_agent" "text"
);


ALTER TABLE "public"."password_reset_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_preferences" (
    "profile_id" "uuid" NOT NULL,
    "sound_enabled" boolean DEFAULT true NOT NULL,
    "reduced_motion" boolean DEFAULT false NOT NULL,
    "theme" "text" DEFAULT 'auto'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profile_preferences_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text", 'auto'::"text"])))
);


ALTER TABLE "public"."profile_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "avatar_url" "text",
    "date_of_birth" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "preferred_language" "text" DEFAULT 'ro'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    CONSTRAINT "profiles_preferred_language_check" CHECK (("preferred_language" = ANY (ARRAY['ro'::"text", 'en'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['teacher'::"text", 'parent'::"text", 'student'::"text", 'admin'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."preferred_language" IS 'User-selected UI language. ''ro'' (default) or ''en''. Must match SUPPORTED_LANGUAGES in src/lib/i18n/config.ts.';



CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" NOT NULL,
    "class_id" "uuid",
    "parent_id" "uuid",
    "username" "text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "consents" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."students" OWNER TO "postgres";


COMMENT ON COLUMN "public"."students"."consents" IS 'Parent-granted consent flags keyed by ConsentKey (EDU-302). Default off; only true counts as granted. Mutated via set_child_consent() RPC.';



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_days"
    ADD CONSTRAINT "activity_days_pkey" PRIMARY KEY ("student_id", "active_day");



ALTER TABLE ONLY "public"."activity_instances"
    ADD CONSTRAINT "activity_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_play_sessions"
    ADD CONSTRAINT "activity_play_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_preview_sessions"
    ADD CONSTRAINT "activity_preview_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_progress"
    ADD CONSTRAINT "activity_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_progress"
    ADD CONSTRAINT "activity_progress_student_id_activity_id_key" UNIQUE ("student_id", "activity_id");



ALTER TABLE ONLY "public"."activity_resources"
    ADD CONSTRAINT "activity_resources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_submission_attempts"
    ADD CONSTRAINT "activity_submission_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_submission_attempts"
    ADD CONSTRAINT "activity_submission_attempts_submission_id_attempt_number_key" UNIQUE ("submission_id", "attempt_number");



ALTER TABLE ONLY "public"."activity_submission_family_shares"
    ADD CONSTRAINT "activity_submission_family_shares_pkey" PRIMARY KEY ("attempt_id");



ALTER TABLE ONLY "public"."activity_submissions"
    ADD CONSTRAINT "activity_submissions_assignment_id_student_id_key" UNIQUE ("assignment_id", "student_id");



ALTER TABLE ONLY "public"."activity_submissions"
    ADD CONSTRAINT "activity_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_types"
    ADD CONSTRAINT "activity_types_pkey" PRIMARY KEY ("type_id");



ALTER TABLE ONLY "public"."activity_versions"
    ADD CONSTRAINT "activity_versions_activity_id_version_number_key" UNIQUE ("activity_id", "version_number");



ALTER TABLE ONLY "public"."activity_versions"
    ADD CONSTRAINT "activity_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."assignments"
    ADD CONSTRAINT "assignments_activity_targets_pin_version" CHECK ((("activity_id" IS NULL) OR ("version_id" IS NOT NULL))) NOT VALID;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_rate_limit_events"
    ADD CONSTRAINT "auth_rate_limit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."child_artifacts"
    ADD CONSTRAINT "child_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flag_events"
    ADD CONSTRAINT "feature_flag_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "public"."learning_path_assignments"
    ADD CONSTRAINT "learning_path_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_path_steps"
    ADD CONSTRAINT "learning_path_steps_id_path_id_key" UNIQUE ("id", "path_id");



ALTER TABLE ONLY "public"."learning_path_steps"
    ADD CONSTRAINT "learning_path_steps_path_id_step_order_key" UNIQUE ("path_id", "step_order");



ALTER TABLE ONLY "public"."learning_path_steps"
    ADD CONSTRAINT "learning_path_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."learning_paths"
    ADD CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."native_activity_submission_targets"
    ADD CONSTRAINT "native_activity_submission_targets_pkey" PRIMARY KEY ("submission_id", "step_id");



ALTER TABLE ONLY "public"."native_activity_submissions"
    ADD CONSTRAINT "native_activity_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parent_children"
    ADD CONSTRAINT "parent_children_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parent_invite_codes"
    ADD CONSTRAINT "parent_invite_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parent_notification_preferences"
    ADD CONSTRAINT "parent_notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."parent_notifications"
    ADD CONSTRAINT "parent_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_requests"
    ADD CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_preferences"
    ADD CONSTRAINT "profile_preferences_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_path_progress"
    ADD CONSTRAINT "student_path_progress_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_path_progress"
    ADD CONSTRAINT "student_path_progress_student_id_path_id_key" UNIQUE ("student_id", "path_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."parent_notification_preferences"
    ADD CONSTRAINT "unique_parent_preferences" UNIQUE ("parent_id");



ALTER TABLE ONLY "public"."parent_children"
    ADD CONSTRAINT "unique_parent_student" UNIQUE ("parent_id", "student_id");



CREATE INDEX "activity_play_sessions_activity" ON "public"."activity_play_sessions" USING "btree" ("activity_id");



CREATE INDEX "activity_play_sessions_student_activity" ON "public"."activity_play_sessions" USING "btree" ("student_id", "activity_id");



CREATE INDEX "activity_play_sessions_version" ON "public"."activity_play_sessions" USING "btree" ("version_id");



CREATE INDEX "feature_flag_events_flag_name_idx" ON "public"."feature_flag_events" USING "btree" ("flag_name", "created_at" DESC);



CREATE INDEX "idx_activities_category" ON "public"."activities" USING "btree" ("category");



CREATE INDEX "idx_activities_owner_visibility_status" ON "public"."activities" USING "btree" ("created_by", "visibility_scope", "status");



CREATE INDEX "idx_activities_public_visibility" ON "public"."activities" USING "btree" ("visibility_scope", "status", "is_published") WHERE ("visibility_scope" = 'public'::"text");



CREATE INDEX "idx_activities_published" ON "public"."activities" USING "btree" ("is_published");



CREATE INDEX "idx_activities_status" ON "public"."activities" USING "btree" ("status");



CREATE INDEX "idx_activities_tags" ON "public"."activities" USING "gin" ("tags");



CREATE INDEX "idx_activities_template" ON "public"."activities" USING "btree" ("template");



CREATE INDEX "idx_activity_instances_assigned_to" ON "public"."activity_instances" USING "btree" ("assigned_to");



CREATE INDEX "idx_activity_instances_class_id" ON "public"."activity_instances" USING "btree" ("class_id");



CREATE INDEX "idx_activity_instances_created_by" ON "public"."activity_instances" USING "btree" ("created_by");



CREATE UNIQUE INDEX "idx_activity_instances_source_step_assigned_to_unique" ON "public"."activity_instances" USING "btree" ("source_learning_path_step_id", "assigned_to") WHERE ("source_learning_path_step_id" IS NOT NULL);



CREATE INDEX "idx_activity_instances_type_id" ON "public"."activity_instances" USING "btree" ("type_id");



CREATE INDEX "idx_activity_preview_sessions_activity_actor" ON "public"."activity_preview_sessions" USING "btree" ("activity_id", "created_by", "expires_at" DESC);



CREATE INDEX "idx_activity_preview_sessions_expires_at" ON "public"."activity_preview_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_activity_progress_activity_id" ON "public"."activity_progress" USING "btree" ("activity_id");



CREATE INDEX "idx_activity_progress_last_version_id" ON "public"."activity_progress" USING "btree" ("last_version_id");



CREATE INDEX "idx_activity_progress_student_id" ON "public"."activity_progress" USING "btree" ("student_id");



CREATE INDEX "idx_activity_progress_student_last_played" ON "public"."activity_progress" USING "btree" ("student_id", "last_played_at" DESC NULLS LAST);



CREATE INDEX "idx_activity_resources_activity_version" ON "public"."activity_resources" USING "btree" ("activity_id", "version_id", "sort_order");



CREATE UNIQUE INDEX "idx_activity_resources_live_order" ON "public"."activity_resources" USING "btree" ("activity_id", "sort_order") WHERE ("version_id" IS NULL);



CREATE UNIQUE INDEX "idx_activity_resources_version_order" ON "public"."activity_resources" USING "btree" ("version_id", "sort_order") WHERE ("version_id" IS NOT NULL);



CREATE INDEX "idx_activity_submission_attempts_review_queue" ON "public"."activity_submission_attempts" USING "btree" ("review_status", "submitted_at" DESC) WHERE ("status" = 'submitted'::"text");



CREATE INDEX "idx_activity_submission_attempts_submission" ON "public"."activity_submission_attempts" USING "btree" ("submission_id", "attempt_number" DESC);



CREATE INDEX "idx_activity_submission_family_shares_recent" ON "public"."activity_submission_family_shares" USING "btree" ("updated_at" DESC, "attempt_id");



CREATE INDEX "idx_activity_submission_family_shares_submission" ON "public"."activity_submission_family_shares" USING "btree" ("submission_id");



CREATE INDEX "idx_activity_submissions_activity_version" ON "public"."activity_submissions" USING "btree" ("activity_id", "version_id");



CREATE INDEX "idx_activity_submissions_assignment_student" ON "public"."activity_submissions" USING "btree" ("assignment_id", "student_id");



CREATE INDEX "idx_activity_submissions_review_queue" ON "public"."activity_submissions" USING "btree" ("status", "updated_at" DESC) WHERE ("status" = ANY (ARRAY['submitted'::"text", 'needs_revision'::"text"]));



CREATE INDEX "idx_activity_submissions_student_status" ON "public"."activity_submissions" USING "btree" ("student_id", "status");



CREATE INDEX "idx_activity_versions_activity_id_version" ON "public"."activity_versions" USING "btree" ("activity_id", "version_number" DESC);



CREATE INDEX "idx_activity_versions_activity_type_id" ON "public"."activity_versions" USING "btree" ("activity_type_id");



CREATE INDEX "idx_assignments_activity_id" ON "public"."assignments" USING "btree" ("activity_id");



CREATE INDEX "idx_assignments_class_activity_id" ON "public"."assignments" USING "btree" ("class_id", "activity_id") WHERE (("class_id" IS NOT NULL) AND ("activity_id" IS NOT NULL));



CREATE INDEX "idx_assignments_class_due_date" ON "public"."assignments" USING "btree" ("class_id", "due_date") WHERE ("class_id" IS NOT NULL);



CREATE INDEX "idx_assignments_class_id" ON "public"."assignments" USING "btree" ("class_id");



CREATE INDEX "idx_assignments_student_activity_id" ON "public"."assignments" USING "btree" ("student_id", "activity_id") WHERE (("student_id" IS NOT NULL) AND ("activity_id" IS NOT NULL));



CREATE INDEX "idx_assignments_student_due_date" ON "public"."assignments" USING "btree" ("student_id", "due_date") WHERE ("student_id" IS NOT NULL);



CREATE INDEX "idx_assignments_student_id" ON "public"."assignments" USING "btree" ("student_id");



CREATE INDEX "idx_assignments_teacher_id" ON "public"."assignments" USING "btree" ("teacher_id");



CREATE INDEX "idx_assignments_version_id" ON "public"."assignments" USING "btree" ("version_id");



CREATE INDEX "idx_audit_log_action" ON "public"."audit_log" USING "btree" ("action");



CREATE INDEX "idx_audit_log_actor_id" ON "public"."audit_log" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_log_artifact_created" ON "public"."audit_log" USING "btree" ("artifact_id", "created_at" DESC);



CREATE INDEX "idx_audit_log_artifact_id" ON "public"."audit_log" USING "btree" ("artifact_id");



CREATE INDEX "idx_audit_log_created_at" ON "public"."audit_log" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action") WHERE ("action" IS NOT NULL);



CREATE INDEX "idx_audit_logs_changed_at" ON "public"."audit_logs" USING "btree" ("changed_at");



CREATE INDEX "idx_audit_logs_changed_by" ON "public"."audit_logs" USING "btree" ("changed_by");



CREATE INDEX "idx_audit_logs_changed_by_at" ON "public"."audit_logs" USING "btree" ("changed_by", "changed_at" DESC);



CREATE INDEX "idx_audit_logs_resource_id_text" ON "public"."audit_logs" USING "btree" ("resource_id_text") WHERE ("resource_id_text" IS NOT NULL);



CREATE INDEX "idx_audit_logs_table_record" ON "public"."audit_logs" USING "btree" ("table_name", "record_id");



CREATE INDEX "idx_auth_rate_limit_events_created" ON "public"."auth_rate_limit_events" USING "btree" ("created_at");



CREATE INDEX "idx_auth_rate_limit_events_identifier_created" ON "public"."auth_rate_limit_events" USING "btree" ("identifier", "created_at" DESC);



CREATE INDEX "idx_child_artifacts_class_id" ON "public"."child_artifacts" USING "btree" ("class_id");



CREATE INDEX "idx_child_artifacts_reviewed_by" ON "public"."child_artifacts" USING "btree" ("reviewed_by") WHERE ("reviewed_by" IS NOT NULL);



CREATE INDEX "idx_child_artifacts_student_id" ON "public"."child_artifacts" USING "btree" ("student_id");



CREATE INDEX "idx_child_artifacts_student_visibility_reviewed" ON "public"."child_artifacts" USING "btree" ("student_id", "visibility", "reviewed_at" DESC NULLS LAST);



CREATE INDEX "idx_child_artifacts_visibility" ON "public"."child_artifacts" USING "btree" ("visibility");



CREATE INDEX "idx_child_artifacts_visibility_created" ON "public"."child_artifacts" USING "btree" ("visibility", "created_at" DESC);



CREATE INDEX "idx_classes_teacher_id" ON "public"."classes" USING "btree" ("teacher_id");



CREATE UNIQUE INDEX "idx_deletion_requests_one_pending" ON "public"."deletion_requests" USING "btree" ("user_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_deletion_requests_pending_schedule" ON "public"."deletion_requests" USING "btree" ("status", "scheduled_deletion_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_deletion_requests_user" ON "public"."deletion_requests" USING "btree" ("user_id");



CREATE INDEX "idx_invite_codes_expires" ON "public"."parent_invite_codes" USING "btree" ("expires_at") WHERE (("used_at" IS NULL) AND ("is_revoked" = false));



CREATE INDEX "idx_invite_codes_student" ON "public"."parent_invite_codes" USING "btree" ("student_id");



CREATE INDEX "idx_invite_codes_teacher" ON "public"."parent_invite_codes" USING "btree" ("teacher_id");



CREATE INDEX "idx_invite_codes_used_by" ON "public"."parent_invite_codes" USING "btree" ("used_by");



CREATE INDEX "idx_learning_path_assignments_class_id" ON "public"."learning_path_assignments" USING "btree" ("class_id");



CREATE INDEX "idx_learning_path_assignments_path_id" ON "public"."learning_path_assignments" USING "btree" ("path_id");



CREATE INDEX "idx_learning_path_assignments_student_id" ON "public"."learning_path_assignments" USING "btree" ("student_id");



CREATE INDEX "idx_learning_path_steps_path_id" ON "public"."learning_path_steps" USING "btree" ("path_id");



CREATE INDEX "idx_learning_paths_created_by" ON "public"."learning_paths" USING "btree" ("created_by");



CREATE INDEX "idx_learning_paths_status" ON "public"."learning_paths" USING "btree" ("status");



CREATE INDEX "idx_notification_prefs_parent" ON "public"."parent_notification_preferences" USING "btree" ("parent_id");



CREATE INDEX "idx_notifications_created" ON "public"."parent_notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_parent" ON "public"."parent_notifications" USING "btree" ("parent_id");



CREATE INDEX "idx_notifications_parent_created" ON "public"."parent_notifications" USING "btree" ("parent_id", "created_at" DESC);



CREATE INDEX "idx_notifications_student" ON "public"."parent_notifications" USING "btree" ("student_id");



CREATE INDEX "idx_notifications_type" ON "public"."parent_notifications" USING "btree" ("type");



CREATE INDEX "idx_notifications_unread" ON "public"."parent_notifications" USING "btree" ("parent_id", "read_at") WHERE ("read_at" IS NULL);



CREATE INDEX "idx_parent_children_parent" ON "public"."parent_children" USING "btree" ("parent_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_parent_children_status" ON "public"."parent_children" USING "btree" ("status");



CREATE INDEX "idx_parent_children_student" ON "public"."parent_children" USING "btree" ("student_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_password_reset_requests_created" ON "public"."password_reset_requests" USING "btree" ("created_at");



CREATE INDEX "idx_password_reset_requests_email_created" ON "public"."password_reset_requests" USING "btree" ("email", "created_at" DESC);



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_profiles_status" ON "public"."profiles" USING "btree" ("status") WHERE ("status" <> 'active'::"text");



CREATE INDEX "idx_student_path_progress_path_id" ON "public"."student_path_progress" USING "btree" ("path_id");



CREATE INDEX "idx_student_path_progress_student_id" ON "public"."student_path_progress" USING "btree" ("student_id");



CREATE INDEX "idx_students_class_id" ON "public"."students" USING "btree" ("class_id");



CREATE INDEX "idx_students_parent_id" ON "public"."students" USING "btree" ("parent_id") WHERE ("parent_id" IS NOT NULL);



CREATE UNIQUE INDEX "learning_path_assignments_unique_class_target" ON "public"."learning_path_assignments" USING "btree" ("path_id", "class_id") WHERE ("class_id" IS NOT NULL);



CREATE UNIQUE INDEX "learning_path_assignments_unique_student_target" ON "public"."learning_path_assignments" USING "btree" ("path_id", "student_id") WHERE ("student_id" IS NOT NULL);



CREATE INDEX "native_activity_submission_targets_step_idx" ON "public"."native_activity_submission_targets" USING "btree" ("step_id");



CREATE INDEX "native_activity_submissions_artifact_idx" ON "public"."native_activity_submissions" USING "btree" ("artifact_id");



CREATE INDEX "native_activity_submissions_instance_idx" ON "public"."native_activity_submissions" USING "btree" ("instance_id", "created_at");



CREATE INDEX "native_activity_submissions_student_idx" ON "public"."native_activity_submissions" USING "btree" ("student_id");



CREATE OR REPLACE TRIGGER "activities_lifecycle_columns_admin_only" BEFORE INSERT OR UPDATE OF "status", "is_published", "config_data", "config_schema_version", "visibility_scope", "created_by" ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_admin_only_lifecycle_columns"();



CREATE OR REPLACE TRIGGER "activity_versions_immutable" BEFORE UPDATE ON "public"."activity_versions" FOR EACH ROW EXECUTE FUNCTION "public"."reject_activity_version_update"();



CREATE OR REPLACE TRIGGER "assignments_activity_integrity" BEFORE INSERT OR UPDATE OF "activity_id", "version_id", "teacher_id" ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_assignment_activity_integrity"();



CREATE OR REPLACE TRIGGER "audit_activities" AFTER INSERT OR DELETE OR UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_trigger"();



CREATE OR REPLACE TRIGGER "audit_activity_progress" AFTER INSERT OR DELETE OR UPDATE ON "public"."activity_progress" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_trigger"();



CREATE OR REPLACE TRIGGER "audit_activity_submission_attempts" AFTER INSERT OR DELETE OR UPDATE ON "public"."activity_submission_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_trigger"();



CREATE OR REPLACE TRIGGER "audit_activity_submissions" AFTER INSERT OR DELETE OR UPDATE ON "public"."activity_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_trigger"();



CREATE OR REPLACE TRIGGER "audit_assignments" AFTER INSERT OR DELETE OR UPDATE ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_trigger"();



CREATE OR REPLACE TRIGGER "audit_child_artifact_delete" BEFORE DELETE ON "public"."child_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."log_child_artifact_change"();



CREATE OR REPLACE TRIGGER "audit_child_artifact_insert" AFTER INSERT ON "public"."child_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."log_child_artifact_change"();



CREATE OR REPLACE TRIGGER "audit_child_artifact_update" AFTER UPDATE ON "public"."child_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."log_child_artifact_change"();



CREATE OR REPLACE TRIGGER "audit_students" AFTER INSERT OR DELETE OR UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."audit_log_trigger"();



CREATE OR REPLACE TRIGGER "capture_activity_day" AFTER INSERT OR UPDATE ON "public"."activity_progress" FOR EACH ROW EXECUTE FUNCTION "public"."capture_activity_day"();



CREATE OR REPLACE TRIGGER "enforce_activity_resource_integrity" BEFORE INSERT OR DELETE OR UPDATE ON "public"."activity_resources" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_activity_resource_integrity"();



CREATE OR REPLACE TRIGGER "enforce_activity_submission_attempt_integrity" BEFORE INSERT OR DELETE OR UPDATE ON "public"."activity_submission_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_activity_submission_attempt_integrity"();



CREATE OR REPLACE TRIGGER "enforce_activity_submission_family_share_integrity" BEFORE INSERT OR UPDATE ON "public"."activity_submission_family_shares" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_activity_submission_family_share_integrity"();



CREATE OR REPLACE TRIGGER "enforce_activity_submission_integrity" BEFORE INSERT OR UPDATE ON "public"."activity_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_activity_submission_integrity"();



CREATE OR REPLACE TRIGGER "guard_learning_path_publication" BEFORE INSERT OR UPDATE ON "public"."learning_paths" FOR EACH ROW EXECUTE FUNCTION "public"."guard_learning_path_definition"();



CREATE OR REPLACE TRIGGER "guard_learning_path_steps" BEFORE INSERT OR DELETE OR UPDATE ON "public"."learning_path_steps" FOR EACH ROW EXECUTE FUNCTION "public"."guard_learning_path_definition"();



CREATE OR REPLACE TRIGGER "on_parent_profile_created" AFTER INSERT ON "public"."profiles" FOR EACH ROW WHEN (("new"."role" = 'parent'::"text")) EXECUTE FUNCTION "public"."create_parent_notification_preferences"();



CREATE OR REPLACE TRIGGER "profile_preferences_set_updated_at" BEFORE UPDATE ON "public"."profile_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."profile_preferences_touch_updated_at"();



CREATE OR REPLACE TRIGGER "students_consents_parent_only" BEFORE UPDATE OF "consents" ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_parent_only_student_consents"();



CREATE OR REPLACE TRIGGER "update_activities_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_instances_updated_at" BEFORE UPDATE ON "public"."activity_instances" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_preview_sessions_updated_at" BEFORE UPDATE ON "public"."activity_preview_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_progress_updated_at" BEFORE UPDATE ON "public"."activity_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_resources_updated_at" BEFORE UPDATE ON "public"."activity_resources" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_submission_attempts_updated_at" BEFORE UPDATE ON "public"."activity_submission_attempts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_submission_family_shares_updated_at" BEFORE UPDATE ON "public"."activity_submission_family_shares" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_submissions_updated_at" BEFORE UPDATE ON "public"."activity_submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_activity_types_updated_at" BEFORE UPDATE ON "public"."activity_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_assignments_updated_at" BEFORE UPDATE ON "public"."assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_child_artifacts_updated_at" BEFORE UPDATE ON "public"."child_artifacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_classes_updated_at" BEFORE UPDATE ON "public"."classes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_deletion_requests_updated_at" BEFORE UPDATE ON "public"."deletion_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_feature_flags_updated_at" BEFORE UPDATE ON "public"."feature_flags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_learning_paths_updated_at" BEFORE UPDATE ON "public"."learning_paths" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notification_prefs_updated_at" BEFORE UPDATE ON "public"."parent_notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_parent_children_updated_at" BEFORE UPDATE ON "public"."parent_children" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_student_path_progress_updated_at" BEFORE UPDATE ON "public"."student_path_progress" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_students_updated_at" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."activity_days"
    ADD CONSTRAINT "activity_days_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_instances"
    ADD CONSTRAINT "activity_instances_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_instances"
    ADD CONSTRAINT "activity_instances_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_instances"
    ADD CONSTRAINT "activity_instances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_instances"
    ADD CONSTRAINT "activity_instances_source_learning_path_step_id_fkey" FOREIGN KEY ("source_learning_path_step_id") REFERENCES "public"."learning_path_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_play_sessions"
    ADD CONSTRAINT "activity_play_sessions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_play_sessions"
    ADD CONSTRAINT "activity_play_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_play_sessions"
    ADD CONSTRAINT "activity_play_sessions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."activity_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_preview_sessions"
    ADD CONSTRAINT "activity_preview_sessions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_preview_sessions"
    ADD CONSTRAINT "activity_preview_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_preview_sessions"
    ADD CONSTRAINT "activity_preview_sessions_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "public"."activity_types"("type_id");



ALTER TABLE ONLY "public"."activity_progress"
    ADD CONSTRAINT "activity_progress_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_progress"
    ADD CONSTRAINT "activity_progress_last_version_id_fkey" FOREIGN KEY ("last_version_id") REFERENCES "public"."activity_versions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_progress"
    ADD CONSTRAINT "activity_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_resources"
    ADD CONSTRAINT "activity_resources_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_resources"
    ADD CONSTRAINT "activity_resources_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_resources"
    ADD CONSTRAINT "activity_resources_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."activity_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_submission_attempts"
    ADD CONSTRAINT "activity_submission_attempts_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_submission_attempts"
    ADD CONSTRAINT "activity_submission_attempts_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."activity_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_submission_family_shares"
    ADD CONSTRAINT "activity_submission_family_shares_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "public"."activity_submission_attempts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_submission_family_shares"
    ADD CONSTRAINT "activity_submission_family_shares_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."activity_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_submissions"
    ADD CONSTRAINT "activity_submissions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_submissions"
    ADD CONSTRAINT "activity_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_submissions"
    ADD CONSTRAINT "activity_submissions_latest_attempt_id_fkey" FOREIGN KEY ("latest_attempt_id") REFERENCES "public"."activity_submission_attempts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_submissions"
    ADD CONSTRAINT "activity_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_submissions"
    ADD CONSTRAINT "activity_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_submissions"
    ADD CONSTRAINT "activity_submissions_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."activity_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."activity_versions"
    ADD CONSTRAINT "activity_versions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_versions"
    ADD CONSTRAINT "activity_versions_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "public"."activity_types"("type_id");



ALTER TABLE ONLY "public"."activity_versions"
    ADD CONSTRAINT "activity_versions_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."assignments"
    ADD CONSTRAINT "assignments_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."activity_versions"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."child_artifacts"
    ADD CONSTRAINT "child_artifacts_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."child_artifacts"
    ADD CONSTRAINT "child_artifacts_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."child_artifacts"
    ADD CONSTRAINT "child_artifacts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_flag_events"
    ADD CONSTRAINT "feature_flag_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feature_flag_events"
    ADD CONSTRAINT "feature_flag_events_flag_name_fkey" FOREIGN KEY ("flag_name") REFERENCES "public"."feature_flags"("name") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parent_children"
    ADD CONSTRAINT "fk_parent_children_invite_code" FOREIGN KEY ("linked_via_code") REFERENCES "public"."parent_invite_codes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."learning_path_assignments"
    ADD CONSTRAINT "learning_path_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_path_assignments"
    ADD CONSTRAINT "learning_path_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_path_assignments"
    ADD CONSTRAINT "learning_path_assignments_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_path_assignments"
    ADD CONSTRAINT "learning_path_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_path_steps"
    ADD CONSTRAINT "learning_path_steps_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."learning_paths"
    ADD CONSTRAINT "learning_paths_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."native_activity_submission_targets"
    ADD CONSTRAINT "native_activity_submission_targets_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."learning_path_steps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."native_activity_submission_targets"
    ADD CONSTRAINT "native_activity_submission_targets_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."native_activity_submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."native_activity_submissions"
    ADD CONSTRAINT "native_activity_submissions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "public"."child_artifacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."native_activity_submissions"
    ADD CONSTRAINT "native_activity_submissions_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "public"."activity_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."native_activity_submissions"
    ADD CONSTRAINT "native_activity_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_children"
    ADD CONSTRAINT "parent_children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_children"
    ADD CONSTRAINT "parent_children_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_invite_codes"
    ADD CONSTRAINT "parent_invite_codes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_invite_codes"
    ADD CONSTRAINT "parent_invite_codes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_invite_codes"
    ADD CONSTRAINT "parent_invite_codes_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."parent_notification_preferences"
    ADD CONSTRAINT "parent_notification_preferences_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_notifications"
    ADD CONSTRAINT "parent_notifications_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parent_notifications"
    ADD CONSTRAINT "parent_notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_preferences"
    ADD CONSTRAINT "profile_preferences_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_path_progress"
    ADD CONSTRAINT "student_path_progress_current_step_fkey" FOREIGN KEY ("current_step_id", "path_id") REFERENCES "public"."learning_path_steps"("id", "path_id") ON DELETE SET NULL ("current_step_id");



ALTER TABLE ONLY "public"."student_path_progress"
    ADD CONSTRAINT "student_path_progress_last_completed_step_fkey" FOREIGN KEY ("last_completed_step_id", "path_id") REFERENCES "public"."learning_path_steps"("id", "path_id") ON DELETE SET NULL ("last_completed_step_id");



ALTER TABLE ONLY "public"."student_path_progress"
    ADD CONSTRAINT "student_path_progress_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "public"."learning_paths"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_path_progress"
    ADD CONSTRAINT "student_path_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



CREATE POLICY "Admins and teachers manage own activity preview sessions" ON "public"."activity_preview_sessions" USING ((("created_by" = "auth"."uid"()) AND ("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."activities" "a" ON (("a"."id" = "activity_preview_sessions"."activity_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'teacher'::"text") AND ("a"."created_by" = "auth"."uid"()) AND ("a"."visibility_scope" = 'private'::"text"))))))) WITH CHECK ((("created_by" = "auth"."uid"()) AND ("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."profiles" "p"
     JOIN "public"."activities" "a" ON (("a"."id" = "activity_preview_sessions"."activity_id")))
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'teacher'::"text") AND ("a"."created_by" = "auth"."uid"()) AND ("a"."visibility_scope" = 'private'::"text")))))));



COMMENT ON POLICY "Admins and teachers manage own activity preview sessions" ON "public"."activity_preview_sessions" IS 'Preview sessions are opaque, actor-owned rows. Admins can manage own rows; teachers can manage only their own sessions for their own private Activities.';



CREATE POLICY "Admins can manage activity progress" ON "public"."activity_progress" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage activity submission attempts" ON "public"."activity_submission_attempts" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage activity submissions" ON "public"."activity_submissions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can manage all activity_instances" ON "public"."activity_instances" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all artifacts" ON "public"."child_artifacts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can manage all learning_paths" ON "public"."learning_paths" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view audit log" ON "public"."audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins can view audit logs" ON "public"."audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage activity submission family shares" ON "public"."activity_submission_family_shares" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage activity_types" ON "public"."activity_types" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage activity_versions" ON "public"."activity_versions" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage all activities" ON "public"."activities" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage all activity resources" ON "public"."activity_resources" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage all learning_path_assignments" ON "public"."learning_path_assignments" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins manage all path_progress" ON "public"."student_path_progress" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins read feature_flag_events" ON "public"."feature_flag_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins read feature_flags" ON "public"."feature_flags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Admins write feature_flags" ON "public"."feature_flags" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "Anyone assigned can view learning_paths" ON "public"."learning_paths" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."learning_path_assignments" "lpa"
  WHERE (("lpa"."path_id" = "learning_paths"."id") AND (("lpa"."student_id" = "auth"."uid"()) OR ("lpa"."class_id" IN ( SELECT "s"."class_id"
           FROM "public"."students" "s"
          WHERE (("s"."id" = "auth"."uid"()) AND ("s"."class_id" IS NOT NULL)))) OR ("lpa"."class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")))))) OR (("status" = 'published'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'admin'::"text"]))))))));



CREATE POLICY "Anyone can insert profile during signup" ON "public"."profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Authenticated view public version activity resources" ON "public"."activity_resources" FOR SELECT USING ((("version_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."activity_versions" "av"
     JOIN "public"."activities" "a" ON (("a"."id" = "av"."activity_id")))
  WHERE (("av"."id" = "activity_resources"."version_id") AND ("a"."id" = "activity_resources"."activity_id") AND ("a"."visibility_scope" = 'public'::"text") AND ("a"."status" = 'published'::"text") AND COALESCE("a"."is_published", false) AND (NOT (EXISTS ( SELECT 1
           FROM "public"."activity_versions" "newer"
          WHERE (("newer"."activity_id" = "av"."activity_id") AND ("newer"."version_number" > "av"."version_number"))))))))));



CREATE POLICY "Inherit learning_path visibility for steps" ON "public"."learning_path_steps" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."learning_paths" "lp"
  WHERE ("lp"."id" = "learning_path_steps"."path_id"))));



CREATE POLICY "Owner can delete own preferences" ON "public"."profile_preferences" FOR DELETE USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "Owner can insert own preferences" ON "public"."profile_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "profile_id"));



CREATE POLICY "Owner can select own preferences" ON "public"."profile_preferences" FOR SELECT USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "Owner can update own preferences" ON "public"."profile_preferences" FOR UPDATE USING (("auth"."uid"() = "profile_id"));



CREATE POLICY "Parents can delete their notifications" ON "public"."parent_notifications" FOR DELETE USING (("parent_id" = "auth"."uid"()));



CREATE POLICY "Parents can insert their preferences" ON "public"."parent_notification_preferences" FOR INSERT WITH CHECK (("parent_id" = "auth"."uid"()));



CREATE POLICY "Parents can link children" ON "public"."parent_children" FOR INSERT WITH CHECK (("parent_id" = "auth"."uid"()));



CREATE POLICY "Parents can update their links" ON "public"."parent_children" FOR UPDATE USING (("parent_id" = "auth"."uid"()));



CREATE POLICY "Parents can update their notifications" ON "public"."parent_notifications" FOR UPDATE USING (("parent_id" = "auth"."uid"()));



CREATE POLICY "Parents can update their preferences" ON "public"."parent_notification_preferences" FOR UPDATE USING (("parent_id" = "auth"."uid"()));



CREATE POLICY "Parents can view child activity progress" ON "public"."activity_progress" FOR SELECT USING (("student_id" IN ( SELECT "public"."get_parent_student_ids"("auth"."uid"()) AS "get_parent_student_ids")));



CREATE POLICY "Parents can view children profiles" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR ("id" IN ( SELECT "public"."get_parent_student_ids"("auth"."uid"()) AS "get_parent_student_ids"))));



CREATE POLICY "Parents can view classes their children belong to" ON "public"."classes" FOR SELECT USING (("id" IN ( SELECT "public"."get_parent_student_class_ids"("auth"."uid"()) AS "get_parent_student_class_ids")));



CREATE POLICY "Parents can view codes they used" ON "public"."parent_invite_codes" FOR SELECT USING (("used_by" = "auth"."uid"()));



CREATE POLICY "Parents can view family-visible artifacts" ON "public"."child_artifacts" FOR SELECT USING ((("visibility" = 'family_visible'::"public"."visibility_status") AND ("student_id" IN ( SELECT "public"."get_parent_child_ids"("auth"."uid"()) AS "get_parent_child_ids"))));



CREATE POLICY "Parents can view their child links" ON "public"."parent_children" FOR SELECT USING ((("parent_id" = "auth"."uid"()) AND ("status" = 'active'::"text")));



CREATE POLICY "Parents can view their children" ON "public"."students" FOR SELECT USING (("auth"."uid"() = "parent_id"));



CREATE POLICY "Parents can view their children via junction table" ON "public"."students" FOR SELECT USING (("id" IN ( SELECT "public"."get_parent_student_ids"("auth"."uid"()) AS "get_parent_student_ids")));



CREATE POLICY "Parents can view their children's assignments" ON "public"."assignments" FOR SELECT USING ((("student_id" IN ( SELECT "parent_children"."student_id"
   FROM "public"."parent_children"
  WHERE (("parent_children"."parent_id" = "auth"."uid"()) AND ("parent_children"."status" = 'active'::"text")))) OR ("student_id" IN ( SELECT "students"."id"
   FROM "public"."students"
  WHERE ("students"."parent_id" = "auth"."uid"()))) OR ("class_id" IN ( SELECT "s"."class_id"
   FROM ("public"."students" "s"
     JOIN "public"."parent_children" "pc" ON (("s"."id" = "pc"."student_id")))
  WHERE (("pc"."parent_id" = "auth"."uid"()) AND ("pc"."status" = 'active'::"text") AND ("s"."class_id" IS NOT NULL)))) OR ("class_id" IN ( SELECT "students"."class_id"
   FROM "public"."students"
  WHERE (("students"."parent_id" = "auth"."uid"()) AND ("students"."class_id" IS NOT NULL))))));



COMMENT ON POLICY "Parents can view their children's assignments" ON "public"."assignments" IS 'Allows parents to view assignments for their children (individual and class-wide)';



CREATE POLICY "Parents can view their notifications" ON "public"."parent_notifications" FOR SELECT USING (("parent_id" = "auth"."uid"()));



CREATE POLICY "Parents can view their preferences" ON "public"."parent_notification_preferences" FOR SELECT USING (("parent_id" = "auth"."uid"()));



CREATE POLICY "Path owners manage steps" ON "public"."learning_path_steps" USING ((((EXISTS ( SELECT 1
   FROM "public"."learning_paths" "lp"
  WHERE (("lp"."id" = "learning_path_steps"."path_id") AND ("lp"."created_by" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'admin'::"text"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))))) WITH CHECK ((((EXISTS ( SELECT 1
   FROM "public"."learning_paths" "lp"
  WHERE (("lp"."id" = "learning_path_steps"."path_id") AND ("lp"."created_by" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'admin'::"text"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "Public can read activity_types" ON "public"."activity_types" FOR SELECT USING (true);



CREATE POLICY "Public reads latest published activity_version" ON "public"."activity_versions" FOR SELECT USING (("public"."is_activity_published"("activity_id") AND ("version_number" = "public"."get_latest_activity_version_number"("activity_id"))));



CREATE POLICY "Public reads public published activities" ON "public"."activities" FOR SELECT USING ((("visibility_scope" = 'public'::"text") AND ("status" = 'published'::"text") AND (COALESCE("is_published", false) = true)));



CREATE POLICY "Service can delete auth rate limit events" ON "public"."auth_rate_limit_events" FOR DELETE TO "service_role" USING (true);



CREATE POLICY "Service can insert auth rate limit events" ON "public"."auth_rate_limit_events" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service can insert password reset requests" ON "public"."password_reset_requests" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service can manage deletion requests" ON "public"."deletion_requests" TO "service_role" USING (true);



CREATE POLICY "Service can read auth rate limit events" ON "public"."auth_rate_limit_events" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service can read password reset requests" ON "public"."password_reset_requests" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role can insert notifications" ON "public"."parent_notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Students can insert own activity progress" ON "public"."activity_progress" FOR INSERT WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can insert own artifacts" ON "public"."child_artifacts" FOR INSERT WITH CHECK ((("auth"."uid"() = "student_id") AND ("visibility" = 'draft'::"public"."visibility_status")));



CREATE POLICY "Students can update own activity progress" ON "public"."activity_progress" FOR UPDATE USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can view assigned activity_instances" ON "public"."activity_instances" FOR SELECT USING (("auth"."uid"() = "assigned_to"));



CREATE POLICY "Students can view own activity progress" ON "public"."activity_progress" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can view own activity submission attempts" ON "public"."activity_submission_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."activity_submissions" "s"
  WHERE (("s"."id" = "activity_submission_attempts"."submission_id") AND ("s"."student_id" = "auth"."uid"())))));



CREATE POLICY "Students can view own activity submissions" ON "public"."activity_submissions" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can view own artifacts" ON "public"."child_artifacts" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students can view own profile" ON "public"."students" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Students can view their assignments" ON "public"."assignments" FOR SELECT USING ((("auth"."uid"() = "student_id") OR (EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "auth"."uid"()) AND ("students"."class_id" = "assignments"."class_id"))))));



CREATE POLICY "Students view assigned version activity resources" ON "public"."activity_resources" FOR SELECT USING ((("version_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."activity_id" = "activity_resources"."activity_id") AND ("a"."version_id" = "activity_resources"."version_id") AND "public"."student_can_access_assignment"("auth"."uid"(), "a"."id"))))));



CREATE POLICY "Students view own path_progress" ON "public"."student_path_progress" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Students view their learning_path_assignments" ON "public"."learning_path_assignments" FOR SELECT USING ((("auth"."uid"() = "student_id") OR ("class_id" IN ( SELECT "s"."class_id"
   FROM "public"."students" "s"
  WHERE (("s"."id" = "auth"."uid"()) AND ("s"."class_id" IS NOT NULL))))));



CREATE POLICY "Teachers can create classes" ON "public"."classes" FOR INSERT WITH CHECK (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can create invite codes" ON "public"."parent_invite_codes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."students"
     JOIN "public"."classes" ON (("students"."class_id" = "classes"."id")))
  WHERE (("students"."id" = "parent_invite_codes"."student_id") AND ("classes"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can create parent links for their students" ON "public"."parent_children" FOR INSERT WITH CHECK (("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids")));



CREATE POLICY "Teachers can delete class artifacts" ON "public"."child_artifacts" FOR DELETE USING (("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")));



CREATE POLICY "Teachers can delete own assignments" ON "public"."assignments" FOR DELETE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can delete own classes" ON "public"."classes" FOR DELETE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can insert activity progress in their classes" ON "public"."activity_progress" FOR INSERT WITH CHECK (("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids")));



CREATE POLICY "Teachers can insert class artifacts" ON "public"."child_artifacts" FOR INSERT WITH CHECK ((("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")) AND ("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids")) AND (EXISTS ( SELECT 1
   FROM "public"."students"
  WHERE (("students"."id" = "child_artifacts"."student_id") AND ("students"."class_id" = "child_artifacts"."class_id")))) AND ((("storage"."foldername"("storage_path"))[1])::"uuid" = "student_id") AND ("visibility" = 'draft'::"public"."visibility_status") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'teacher'::"text"))))));



CREATE POLICY "Teachers can insert own roster assignments" ON "public"."assignments" FOR INSERT WITH CHECK ((("auth"."uid"() = "teacher_id") AND "public"."teacher_owns_assignment_target"("teacher_id", "class_id", "student_id")));



CREATE POLICY "Teachers can insert students" ON "public"."students" FOR INSERT WITH CHECK ((("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")) OR ("class_id" IS NULL) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "Teachers can manage own activity_instances" ON "public"."activity_instances" USING ((("auth"."uid"() = "created_by") OR ("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids"))));



CREATE POLICY "Teachers can manage own learning_paths" ON "public"."learning_paths" USING ((("auth"."uid"() = "created_by") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'admin'::"text"]))))))) WITH CHECK ((("auth"."uid"() = "created_by") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'admin'::"text"])))))));



CREATE POLICY "Teachers can review submissions for own assignments" ON "public"."activity_submissions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."id" = "activity_submissions"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."id" = "activity_submissions"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can update activity progress in their classes" ON "public"."activity_progress" FOR UPDATE USING (("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids"))) WITH CHECK (("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids")));



CREATE POLICY "Teachers can update class artifacts" ON "public"."child_artifacts" FOR UPDATE USING (("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")));



CREATE POLICY "Teachers can update own classes" ON "public"."classes" FOR UPDATE USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can update own roster assignments" ON "public"."assignments" FOR UPDATE USING (("auth"."uid"() = "teacher_id")) WITH CHECK ((("auth"."uid"() = "teacher_id") AND "public"."teacher_owns_assignment_target"("teacher_id", "class_id", "student_id")));



CREATE POLICY "Teachers can update students" ON "public"."students" FOR UPDATE USING (("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")));



CREATE POLICY "Teachers can update their codes" ON "public"."parent_invite_codes" FOR UPDATE USING ((("teacher_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."students"
     JOIN "public"."classes" ON (("students"."class_id" = "classes"."id")))
  WHERE (("students"."id" = "parent_invite_codes"."student_id") AND ("classes"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can view activity progress in their classes" ON "public"."activity_progress" FOR SELECT USING (("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids")));



CREATE POLICY "Teachers can view attempts for own assignments" ON "public"."activity_submission_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."activity_submissions" "s"
     JOIN "public"."assignments" "a" ON (("a"."id" = "s"."assignment_id")))
  WHERE (("s"."id" = "activity_submission_attempts"."submission_id") AND ("a"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers can view class artifacts" ON "public"."child_artifacts" FOR SELECT USING (("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")));



CREATE POLICY "Teachers can view class audit logs" ON "public"."audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."child_artifacts"
  WHERE (("child_artifacts"."id" = "audit_log"."artifact_id") AND ("child_artifacts"."class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids"))))));



CREATE POLICY "Teachers can view codes for their students" ON "public"."parent_invite_codes" FOR SELECT USING ((("teacher_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."students"
     JOIN "public"."classes" ON (("students"."class_id" = "classes"."id")))
  WHERE (("students"."id" = "parent_invite_codes"."student_id") AND ("classes"."teacher_id" = "auth"."uid"()))))));



CREATE POLICY "Teachers can view own assignments" ON "public"."assignments" FOR SELECT USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view own classes" ON "public"."classes" FOR SELECT USING (("auth"."uid"() = "teacher_id"));



CREATE POLICY "Teachers can view parent links for their students" ON "public"."parent_children" FOR SELECT USING (("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids")));



CREATE POLICY "Teachers can view student profiles" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR ("id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids"))));



CREATE POLICY "Teachers can view students" ON "public"."students" FOR SELECT USING (("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")));



CREATE POLICY "Teachers can view submissions for own assignments" ON "public"."activity_submissions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."assignments" "a"
  WHERE (("a"."id" = "activity_submissions"."assignment_id") AND ("a"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers create own private activities" ON "public"."activities" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'teacher'::"text")))) AND ("created_by" = "auth"."uid"()) AND ("visibility_scope" = 'private'::"text")));



CREATE POLICY "Teachers delete own live activity resources" ON "public"."activity_resources" FOR DELETE USING ((("version_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_resources"."activity_id") AND ("a"."created_by" = "auth"."uid"()) AND ("a"."visibility_scope" = 'private'::"text"))))));



CREATE POLICY "Teachers insert own live activity resources" ON "public"."activity_resources" FOR INSERT WITH CHECK ((("version_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_resources"."activity_id") AND ("a"."created_by" = "auth"."uid"()) AND ("a"."visibility_scope" = 'private'::"text"))))));



CREATE POLICY "Teachers manage own learning_path_assignments" ON "public"."learning_path_assignments" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'admin'::"text"]))))) AND (("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")) OR (("class_id" IS NULL) AND ("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids")))))) WITH CHECK ((("auth"."uid"() = "assigned_by") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'admin'::"text"]))))) AND (("class_id" IN ( SELECT "public"."get_teacher_class_ids"("auth"."uid"()) AS "get_teacher_class_ids")) OR (("class_id" IS NULL) AND ("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids"))))));



CREATE POLICY "Teachers read own private activities" ON "public"."activities" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'teacher'::"text")))) AND ("created_by" = "auth"."uid"()) AND ("visibility_scope" = 'private'::"text")));



CREATE POLICY "Teachers update own live activity resources" ON "public"."activity_resources" FOR UPDATE USING ((("version_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_resources"."activity_id") AND ("a"."created_by" = "auth"."uid"()) AND ("a"."visibility_scope" = 'private'::"text")))))) WITH CHECK ((("version_id" IS NULL) AND (EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_resources"."activity_id") AND ("a"."created_by" = "auth"."uid"()) AND ("a"."visibility_scope" = 'private'::"text"))))));



CREATE POLICY "Teachers update own private activities" ON "public"."activities" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'teacher'::"text")))) AND ("created_by" = "auth"."uid"()) AND ("visibility_scope" = 'private'::"text"))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'teacher'::"text")))) AND ("created_by" = "auth"."uid"()) AND ("visibility_scope" = 'private'::"text")));



CREATE POLICY "Teachers view + override class path_progress" ON "public"."student_path_progress" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'admin'::"text"]))))) AND ((EXISTS ( SELECT 1
   FROM "public"."learning_paths" "lp"
  WHERE (("lp"."id" = "student_path_progress"."path_id") AND ("lp"."created_by" = "auth"."uid"())))) OR ("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids"))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'admin'::"text"]))))) AND ((EXISTS ( SELECT 1
   FROM "public"."learning_paths" "lp"
  WHERE (("lp"."id" = "student_path_progress"."path_id") AND ("lp"."created_by" = "auth"."uid"())))) OR ("student_id" IN ( SELECT "public"."get_teacher_student_ids"("auth"."uid"()) AS "get_teacher_student_ids")))));



CREATE POLICY "Teachers view family shares for own assignments" ON "public"."activity_submission_family_shares" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."activity_submissions" "s"
     JOIN "public"."assignments" "a" ON (("a"."id" = "s"."assignment_id")))
  WHERE (("s"."id" = "activity_submission_family_shares"."submission_id") AND ("a"."teacher_id" = "auth"."uid"())))));



CREATE POLICY "Teachers view own activity resources" ON "public"."activity_resources" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."activities" "a"
  WHERE (("a"."id" = "activity_resources"."activity_id") AND ("a"."created_by" = "auth"."uid"()) AND ("a"."visibility_scope" = 'private'::"text")))));



CREATE POLICY "Users can cancel own deletion requests" ON "public"."deletion_requests" FOR UPDATE USING ((("user_id" = "auth"."uid"()) AND ("status" = 'pending'::"text")));



CREATE POLICY "Users can create own deletion requests" ON "public"."deletion_requests" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['teacher'::"text", 'parent'::"text", 'admin'::"text"])))))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own deletion requests" ON "public"."deletion_requests" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_days" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_days_read" ON "public"."activity_days" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("student_id" IN ( SELECT "public"."get_teacher_student_ids"(( SELECT "auth"."uid"() AS "uid")) AS "get_teacher_student_ids")) OR ("student_id" IN ( SELECT "public"."get_parent_student_ids"(( SELECT "auth"."uid"() AS "uid")) AS "get_parent_student_ids")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



ALTER TABLE "public"."activity_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_play_sessions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_play_sessions_read" ON "public"."activity_play_sessions" FOR SELECT TO "authenticated" USING ((("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



ALTER TABLE "public"."activity_preview_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_resources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_submission_attempts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_submission_family_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_rate_limit_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."child_artifacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deletion_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flag_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_path_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_path_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."learning_paths" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."native_activity_submission_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."native_activity_submissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_native_submission_targets" ON "public"."native_activity_submission_targets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."native_activity_submissions" "s"
  WHERE (("s"."id" = "native_activity_submission_targets"."submission_id") AND ("s"."student_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "own_native_submissions" ON "public"."native_activity_submissions" FOR SELECT TO "authenticated" USING (("student_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."parent_children" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parent_invite_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parent_notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parent_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profile_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_path_progress" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."parent_notifications";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "directus_admin";





























































































































































































GRANT ALL ON TABLE "public"."native_activity_submissions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."native_activity_submissions" TO "directus_admin";
GRANT SELECT ON TABLE "public"."native_activity_submissions" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."accept_native_activity_submission"("p_student_id" "uuid", "p_instance_id" "uuid", "p_submission_id" "uuid", "p_type_id" "text", "p_storage_path" "text", "p_duration_ms" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_native_activity_submission"("p_student_id" "uuid", "p_instance_id" "uuid", "p_submission_id" "uuid", "p_type_id" "text", "p_storage_path" "text", "p_duration_ms" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."activity_version_shares_with_family"("p_version_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."activity_version_shares_with_family"("p_version_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."activity_version_shares_with_family"("p_version_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."activity_version_shares_with_family"("p_version_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."advance_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_completed_step_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."advance_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_completed_step_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."learning_path_steps" TO "anon";
GRANT ALL ON TABLE "public"."learning_path_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_path_steps" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."learning_path_steps" TO "directus_admin";



REVOKE ALL ON FUNCTION "public"."append_learning_path_step"("p_path_id" "uuid", "p_title" "text", "p_activity_type" "text", "p_config" "jsonb", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."append_learning_path_step"("p_path_id" "uuid", "p_title" "text", "p_activity_type" "text", "p_config" "jsonb", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_learning_path_step"("p_path_id" "uuid", "p_title" "text", "p_activity_type" "text", "p_config" "jsonb", "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."archive_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."archive_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_log_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_log_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_log_trigger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."capture_activity_day"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."capture_activity_day"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."change_artifact_visibility"("p_artifact_id" "uuid", "p_visibility" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_artifact_visibility"("p_artifact_id" "uuid", "p_visibility" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_artifact_visibility"("p_artifact_id" "uuid", "p_visibility" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_activity_version_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_activity_version_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_parent_notification_preferences"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_parent_notification_preferences"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_parent_notification_preferences"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."duplicate_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."duplicate_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_activity_resource_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_activity_resource_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_activity_resource_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_activity_submission_attempt_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_activity_submission_attempt_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_activity_submission_attempt_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_activity_submission_family_share_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_activity_submission_family_share_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_activity_submission_family_share_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_activity_submission_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_activity_submission_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_activity_submission_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_admin_only_lifecycle_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_admin_only_lifecycle_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_admin_only_lifecycle_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_assignment_activity_integrity"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_assignment_activity_integrity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_assignment_activity_integrity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_parent_only_student_consents"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_parent_only_student_consents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_parent_only_student_consents"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."execute_pending_deletions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."execute_pending_deletions"() TO "anon";
GRANT ALL ON FUNCTION "public"."execute_pending_deletions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_pending_deletions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_activity_version_number"("p_activity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_activity_version_number"("p_activity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_activity_version_number"("p_activity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_parent_child_ids"("parent_uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_parent_child_ids"("parent_uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_parent_child_ids"("parent_uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_parent_student_class_ids"("parent_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_parent_student_class_ids"("parent_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_parent_student_class_ids"("parent_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_parent_student_ids"("parent_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_parent_student_ids"("parent_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_parent_student_ids"("parent_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_student_classmates"("p_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_student_classmates"("p_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_student_classmates"("p_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_student_classmates"("p_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_teacher_class_ids"("teacher_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_teacher_class_ids"("teacher_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_teacher_class_ids"("teacher_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_teacher_student_ids"("teacher_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_teacher_student_ids"("teacher_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_teacher_student_ids"("teacher_uuid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_learning_path_definition"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_learning_path_definition"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_activity_published"("p_activity_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_activity_published"("p_activity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_activity_published"("p_activity_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_child_artifact_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_child_artifact_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_child_artifact_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."make_teacher_activity_ready_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."make_teacher_activity_ready_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_linked_parents"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."notify_linked_parents"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_linked_parents"("p_student_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_data" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."student_path_progress" TO "anon";
GRANT ALL ON TABLE "public"."student_path_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."student_path_progress" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."student_path_progress" TO "directus_admin";



REVOKE ALL ON FUNCTION "public"."override_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_status" "text", "p_current_step_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."override_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_status" "text", "p_current_step_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."override_learning_path_progress"("p_student_id" "uuid", "p_path_id" "uuid", "p_status" "text", "p_current_step_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."profile_preferences_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."profile_preferences_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."profile_preferences_touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."publish_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) TO "service_role";



GRANT ALL ON TABLE "public"."learning_paths" TO "anon";
GRANT ALL ON TABLE "public"."learning_paths" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_paths" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."learning_paths" TO "directus_admin";



REVOKE ALL ON FUNCTION "public"."publish_learning_path"("p_path_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."publish_learning_path"("p_path_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_learning_path"("p_path_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."activity_progress" TO "anon";
GRANT ALL ON TABLE "public"."activity_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_progress" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_progress" TO "directus_admin";



REVOKE ALL ON FUNCTION "public"."record_activity_play_session"("p_student_id" "uuid", "p_activity_id" "uuid", "p_session_id" "uuid", "p_sequence" integer, "p_elapsed_seconds" integer, "p_status" "text", "p_version_id" "uuid", "p_score" integer, "p_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_activity_play_session"("p_student_id" "uuid", "p_activity_id" "uuid", "p_session_id" "uuid", "p_sequence" integer, "p_elapsed_seconds" integer, "p_status" "text", "p_version_id" "uuid", "p_score" integer, "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_activity_play_session"("p_student_id" "uuid", "p_activity_id" "uuid", "p_session_id" "uuid", "p_sequence" integer, "p_elapsed_seconds" integer, "p_status" "text", "p_version_id" "uuid", "p_score" integer, "p_data" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."activity_submissions" TO "anon";
GRANT ALL ON TABLE "public"."activity_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_submissions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_submissions" TO "directus_admin";



REVOKE ALL ON FUNCTION "public"."record_activity_submission"("p_assignment_id" "uuid", "p_activity_id" "uuid", "p_version_id" "uuid", "p_intent" "text", "p_response" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_activity_submission"("p_assignment_id" "uuid", "p_activity_id" "uuid", "p_version_id" "uuid", "p_intent" "text", "p_response" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."record_activity_submission"("p_assignment_id" "uuid", "p_activity_id" "uuid", "p_version_id" "uuid", "p_intent" "text", "p_response" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_activity_submission"("p_assignment_id" "uuid", "p_activity_id" "uuid", "p_version_id" "uuid", "p_intent" "text", "p_response" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_activity_version_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."reject_activity_version_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_activity_version_update"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reorder_learning_path_steps"("p_path_id" "uuid", "p_ordered_step_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reorder_learning_path_steps"("p_path_id" "uuid", "p_ordered_step_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_learning_path_steps"("p_path_id" "uuid", "p_ordered_step_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_learning_path_steps"("p_path_id" "uuid", "p_ordered_step_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."restore_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."restore_teacher_activity_atomically"("p_activity_id" "uuid", "p_actor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."retry_native_activity_progress"("p_student_id" "uuid", "p_submission_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."retry_native_activity_progress"("p_student_id" "uuid", "p_submission_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revert_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revert_activity_atomically"("p_activity_id" "uuid", "p_activity_type_id" "text", "p_config_data" "jsonb", "p_config_schema_version" integer, "p_actor_id" "uuid", "p_before_status" "text", "p_before_is_published" boolean, "p_before_config_schema_version" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_activity_submission"("p_submission_id" "uuid", "p_decision" "text", "p_teacher_feedback" "text", "p_family_comment" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_activity_submission"("p_submission_id" "uuid", "p_decision" "text", "p_teacher_feedback" "text", "p_family_comment" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."review_activity_submission"("p_submission_id" "uuid", "p_decision" "text", "p_teacher_feedback" "text", "p_family_comment" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_activity_submission"("p_submission_id" "uuid", "p_decision" "text", "p_teacher_feedback" "text", "p_family_comment" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_teacher_activity_draft"("p_draft" "jsonb", "p_activity_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_teacher_activity_draft"("p_draft" "jsonb", "p_activity_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_teacher_activity_draft"("p_draft" "jsonb", "p_activity_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_child_consent"("p_child_id" "uuid", "p_consent_key" "text", "p_value" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_child_consent"("p_child_id" "uuid", "p_consent_key" "text", "p_value" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."set_child_consent"("p_child_id" "uuid", "p_consent_key" "text", "p_value" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_child_consent"("p_child_id" "uuid", "p_consent_key" "text", "p_value" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."should_notify_parent"("p_parent_id" "uuid", "p_notification_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."should_notify_parent"("p_parent_id" "uuid", "p_notification_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."should_notify_parent"("p_parent_id" "uuid", "p_notification_type" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_can_access_assignment"("p_student_id" "uuid", "p_assignment_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_can_access_assignment"("p_student_id" "uuid", "p_assignment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."student_can_access_assignment"("p_student_id" "uuid", "p_assignment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."student_can_access_assignment"("p_student_id" "uuid", "p_assignment_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."teacher_can_review_submission"("p_teacher_id" "uuid", "p_submission_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."teacher_can_review_submission"("p_teacher_id" "uuid", "p_submission_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."teacher_can_review_submission"("p_teacher_id" "uuid", "p_submission_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."teacher_can_review_submission"("p_teacher_id" "uuid", "p_submission_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."teacher_owns_assignment_target"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."teacher_owns_assignment_target"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_student_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."teacher_owns_assignment_target"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_student_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."teacher_owns_assignment_target"("p_teacher_id" "uuid", "p_class_id" "uuid", "p_student_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activities" TO "directus_admin";



GRANT ALL ON TABLE "public"."activity_days" TO "service_role";
GRANT SELECT ON TABLE "public"."activity_days" TO "authenticated";



GRANT ALL ON TABLE "public"."activity_instances" TO "anon";
GRANT ALL ON TABLE "public"."activity_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_instances" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_instances" TO "directus_admin";



GRANT ALL ON TABLE "public"."activity_play_sessions" TO "service_role";
GRANT SELECT ON TABLE "public"."activity_play_sessions" TO "authenticated";



GRANT ALL ON TABLE "public"."activity_preview_sessions" TO "anon";
GRANT ALL ON TABLE "public"."activity_preview_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_preview_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."activity_resources" TO "anon";
GRANT ALL ON TABLE "public"."activity_resources" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_resources" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_resources" TO "directus_admin";



GRANT ALL ON TABLE "public"."activity_submission_attempts" TO "anon";
GRANT ALL ON TABLE "public"."activity_submission_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_submission_attempts" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_submission_attempts" TO "directus_admin";



GRANT ALL ON TABLE "public"."activity_submission_family_shares" TO "anon";
GRANT ALL ON TABLE "public"."activity_submission_family_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_submission_family_shares" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_submission_family_shares" TO "directus_admin";



GRANT ALL ON TABLE "public"."activity_types" TO "anon";
GRANT ALL ON TABLE "public"."activity_types" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_types" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_types" TO "directus_admin";



GRANT ALL ON TABLE "public"."activity_versions" TO "anon";
GRANT ALL ON TABLE "public"."activity_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_versions" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."activity_versions" TO "directus_admin";



GRANT ALL ON TABLE "public"."assignments" TO "anon";
GRANT ALL ON TABLE "public"."assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."assignments" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."assignments" TO "directus_admin";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_log" TO "directus_admin";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";
GRANT SELECT,USAGE ON SEQUENCE "public"."audit_logs_id_seq" TO "directus_admin";



GRANT ALL ON TABLE "public"."auth_rate_limit_events" TO "anon";
GRANT ALL ON TABLE "public"."auth_rate_limit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_rate_limit_events" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."auth_rate_limit_events" TO "directus_admin";



GRANT ALL ON TABLE "public"."child_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."child_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."child_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."classes" TO "directus_admin";



GRANT ALL ON TABLE "public"."deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."deletion_requests" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flag_events" TO "anon";
GRANT ALL ON TABLE "public"."feature_flag_events" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flag_events" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feature_flag_events" TO "directus_admin";



GRANT ALL ON TABLE "public"."feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."feature_flags" TO "directus_admin";



GRANT ALL ON TABLE "public"."learning_path_assignments" TO "anon";
GRANT ALL ON TABLE "public"."learning_path_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."learning_path_assignments" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."learning_path_assignments" TO "directus_admin";



GRANT ALL ON TABLE "public"."native_activity_submission_targets" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."native_activity_submission_targets" TO "directus_admin";
GRANT SELECT ON TABLE "public"."native_activity_submission_targets" TO "authenticated";



GRANT ALL ON TABLE "public"."parent_children" TO "anon";
GRANT ALL ON TABLE "public"."parent_children" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_children" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."parent_children" TO "directus_admin";



GRANT ALL ON TABLE "public"."parent_invite_codes" TO "anon";
GRANT ALL ON TABLE "public"."parent_invite_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_invite_codes" TO "service_role";



GRANT ALL ON TABLE "public"."parent_notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."parent_notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_notification_preferences" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."parent_notification_preferences" TO "directus_admin";



GRANT ALL ON TABLE "public"."parent_notifications" TO "anon";
GRANT ALL ON TABLE "public"."parent_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."parent_notifications" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."parent_notifications" TO "directus_admin";



GRANT ALL ON TABLE "public"."password_reset_requests" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_requests" TO "service_role";



GRANT ALL ON TABLE "public"."profile_preferences" TO "anon";
GRANT ALL ON TABLE "public"."profile_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_preferences" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profile_preferences" TO "directus_admin";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "directus_admin";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."students" TO "directus_admin";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES  TO "directus_admin";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES  TO "directus_admin";































-- Application policies and trigger on Supabase-managed schemas.
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "Admins manage child artifacts" ON storage.objects USING (((bucket_id = 'child-artifacts'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))) WITH CHECK (((bucket_id = 'child-artifacts'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text))))));

CREATE POLICY "Parents select family-visible artifacts" ON storage.objects FOR SELECT USING (((bucket_id = 'child-artifacts'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.child_artifacts ca
  WHERE ((ca.storage_path = objects.name) AND (ca.visibility = 'family_visible'::public.visibility_status) AND (ca.student_id IN ( SELECT public.get_parent_student_ids(auth.uid()) AS get_parent_student_ids)))))));

CREATE POLICY "Public read access for activity renderers" ON storage.objects FOR SELECT USING ((bucket_id = 'activity-renderers'::text));

CREATE POLICY "Public read access for assets" ON storage.objects FOR SELECT USING ((bucket_id = 'assets'::text));

CREATE POLICY "Students insert own child artifacts" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'child-artifacts'::text) AND (auth.role() = 'authenticated'::text) AND (auth.uid() IS NOT NULL) AND ((storage.foldername(name))[1] = (auth.uid())::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'student'::text))))));

CREATE POLICY "Teachers can delete assets" ON storage.objects FOR DELETE USING (((bucket_id = 'assets'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::text, 'admin'::text])))))));

CREATE POLICY "Teachers can update assets" ON storage.objects FOR UPDATE USING (((bucket_id = 'assets'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::text, 'admin'::text])))))));

CREATE POLICY "Teachers can upload assets" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'assets'::text) AND (auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['teacher'::text, 'admin'::text])))))));

CREATE POLICY "Teachers delete class child artifacts" ON storage.objects FOR DELETE USING (((bucket_id = 'child-artifacts'::text) AND (auth.role() = 'authenticated'::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT public.get_teacher_student_ids(auth.uid()) AS get_teacher_student_ids))));

CREATE POLICY "Teachers insert child artifacts" ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'child-artifacts'::text) AND (auth.role() = 'authenticated'::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT public.get_teacher_student_ids(auth.uid()) AS get_teacher_student_ids)) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'teacher'::text))))));

CREATE POLICY "Teachers select class child artifacts" ON storage.objects FOR SELECT USING (((bucket_id = 'child-artifacts'::text) AND (auth.role() = 'authenticated'::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT public.get_teacher_student_ids(auth.uid()) AS get_teacher_student_ids))));

CREATE POLICY "Teachers update class child artifacts" ON storage.objects FOR UPDATE USING (((bucket_id = 'child-artifacts'::text) AND (auth.role() = 'authenticated'::text) AND (((storage.foldername(name))[1])::uuid IN ( SELECT public.get_teacher_student_ids(auth.uid()) AS get_teacher_student_ids))));

-- Migration-owned baseline data.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('assets', 'assets', true, NULL, NULL),
  ('child-artifacts', 'child-artifacts', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'audio/webm', 'audio/ogg']),
  ('activity-renderers', 'activity-renderers', true, NULL, NULL);

INSERT INTO public.feature_flags (name, description, enabled, targeting) VALUES
  ('game_builder_beta', 'Internal beta gate for the game-builder admin page.', false, '{}'::jsonb);

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

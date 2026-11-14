-- Restore lifecycle action for teacher-owned private archived Activities.
-- Restoring only changes the Activity back to an active lifecycle status; it does
-- not delete, mutate, or repoint versions, assignments, submissions, or resources.

CREATE OR REPLACE FUNCTION public.restore_teacher_activity_atomically(
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

COMMENT ON FUNCTION public.restore_teacher_activity_atomically(UUID, UUID) IS
  'Restores a teacher-owned private archived Activity to draft or ready status based on is_published, without mutating versions, assignments, submissions, resources, or family-share metadata. Service-role only.';

REVOKE ALL ON FUNCTION public.restore_teacher_activity_atomically(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_teacher_activity_atomically(UUID, UUID) TO service_role;

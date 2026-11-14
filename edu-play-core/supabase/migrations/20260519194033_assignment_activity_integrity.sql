-- Defense-in-depth for assigning Activity versions, especially private teacher content.

CREATE OR REPLACE FUNCTION public.enforce_assignment_activity_integrity()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS assignments_activity_integrity ON public.assignments;
CREATE TRIGGER assignments_activity_integrity
  BEFORE INSERT OR UPDATE OF activity_id, version_id, teacher_id
  ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_assignment_activity_integrity();

COMMENT ON FUNCTION public.enforce_assignment_activity_integrity() IS
  'Ensures Activity assignments target ready activities, pin a version for the same activity, and do not let teachers assign private Activities owned by another teacher.';

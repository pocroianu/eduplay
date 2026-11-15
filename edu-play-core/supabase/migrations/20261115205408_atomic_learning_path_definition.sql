-- Definition writes share the parent-row lock used by reorder.
CREATE FUNCTION public.append_learning_path_step(
  p_path_id uuid, p_title text, p_activity_type text,
  p_config jsonb DEFAULT '{}'::jsonb, p_description text DEFAULT NULL
) RETURNS SETOF public.learning_path_steps
LANGUAGE plpgsql SET search_path = public AS $$
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
CREATE FUNCTION public.publish_learning_path(p_path_id uuid)
RETURNS SETOF public.learning_paths
LANGUAGE plpgsql SET search_path = public AS $$
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
REVOKE ALL ON FUNCTION public.append_learning_path_step(uuid,text,text,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.publish_learning_path(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.append_learning_path_step(uuid,text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_learning_path(uuid) TO authenticated;

-- Invoker privileges retain ownership RLS. Trusted imports/fixtures may build
-- published definitions; authenticated callers, including admins, cannot.
CREATE FUNCTION public.guard_learning_path_definition() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
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
REVOKE ALL ON FUNCTION public.guard_learning_path_definition() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_learning_path_steps BEFORE INSERT OR UPDATE OR DELETE ON public.learning_path_steps
FOR EACH ROW EXECUTE FUNCTION public.guard_learning_path_definition();
CREATE TRIGGER guard_learning_path_publication BEFORE INSERT OR UPDATE ON public.learning_paths
FOR EACH ROW EXECUTE FUNCTION public.guard_learning_path_definition();

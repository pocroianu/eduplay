-- EDU-620: make teacher path step reorder atomic.
--
-- PR #194 initially used a two-phase loop in the server action to avoid
-- UNIQUE(path_id, step_order) collisions during swaps. That kept each row
-- write in a separate request, so a later failure could leave temporary or
-- partial order values. This RPC runs the same two-phase rewrite inside one
-- database transaction and keeps RLS as the write boundary.

CREATE OR REPLACE FUNCTION public.reorder_learning_path_steps(
  p_path_id UUID,
  p_ordered_step_ids UUID[]
)
RETURNS TABLE(id UUID, step_order INT)
LANGUAGE plpgsql
SET search_path = public
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

REVOKE ALL ON FUNCTION public.reorder_learning_path_steps(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_learning_path_steps(UUID, UUID[]) TO authenticated;

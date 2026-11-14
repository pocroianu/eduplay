-- Enforce Issue 9's "at least one response" rule at the database boundary.
-- The API schema also validates this, but authenticated students can execute
-- record_activity_submission(...) directly, so submitted rows/attempts need a
-- CHECK constraint too.

ALTER TABLE public.activity_submission_attempts
  DROP CONSTRAINT IF EXISTS activity_submission_attempts_submitted_response_content;

ALTER TABLE public.activity_submission_attempts
  ADD CONSTRAINT activity_submission_attempts_submitted_response_content
  CHECK (
    status <> 'submitted'
    OR NULLIF(BTRIM(COALESCE(response->>'text', '')), '') IS NOT NULL
    OR COALESCE(
      jsonb_typeof(response->'drawing') = 'object'
      AND response->'drawing' <> '{}'::jsonb,
      FALSE
    )
    OR COALESCE(
      jsonb_typeof(response->'voice') = 'object'
      AND response->'voice' <> '{}'::jsonb,
      FALSE
    )
    OR COALESCE(
      jsonb_typeof(response->'artifacts') = 'array'
      AND jsonb_array_length(response->'artifacts') > 0,
      FALSE
    )
  );

ALTER TABLE public.activity_submissions
  DROP CONSTRAINT IF EXISTS activity_submissions_final_response_content;

ALTER TABLE public.activity_submissions
  ADD CONSTRAINT activity_submissions_final_response_content
  CHECK (
    status NOT IN ('submitted', 'approved')
    OR NULLIF(BTRIM(COALESCE(latest_response->>'text', '')), '') IS NOT NULL
    OR COALESCE(
      jsonb_typeof(latest_response->'drawing') = 'object'
      AND latest_response->'drawing' <> '{}'::jsonb,
      FALSE
    )
    OR COALESCE(
      jsonb_typeof(latest_response->'voice') = 'object'
      AND latest_response->'voice' <> '{}'::jsonb,
      FALSE
    )
    OR COALESCE(
      jsonb_typeof(latest_response->'artifacts') = 'array'
      AND jsonb_array_length(latest_response->'artifacts') > 0,
      FALSE
    )
  );

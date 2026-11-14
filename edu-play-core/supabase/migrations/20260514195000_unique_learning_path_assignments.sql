-- EDU-553: make path assignment target uniqueness atomic.
--
-- Keep the newest duplicate row for each target before adding partial unique
-- indexes. This makes the migration safe if a prior check-then-insert race
-- already produced duplicate rows.

WITH ranked_class_assignments AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY path_id, class_id
      ORDER BY created_at DESC, id DESC
    ) AS row_rank
  FROM learning_path_assignments
  WHERE class_id IS NOT NULL
)
DELETE FROM learning_path_assignments lpa
USING ranked_class_assignments ranked
WHERE lpa.id = ranked.id
  AND ranked.row_rank > 1;

WITH ranked_student_assignments AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY path_id, student_id
      ORDER BY created_at DESC, id DESC
    ) AS row_rank
  FROM learning_path_assignments
  WHERE student_id IS NOT NULL
)
DELETE FROM learning_path_assignments lpa
USING ranked_student_assignments ranked
WHERE lpa.id = ranked.id
  AND ranked.row_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS learning_path_assignments_unique_class_target
  ON learning_path_assignments (path_id, class_id)
  WHERE class_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS learning_path_assignments_unique_student_target
  ON learning_path_assignments (path_id, student_id)
  WHERE student_id IS NOT NULL;

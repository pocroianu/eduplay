-- ============================================================================
-- Option B Activity progress migration
-- Progress becomes Activity-native while legacy games/game_progress remain as
-- temporary compatibility surfaces.
-- ============================================================================

-- 1. Assignments keep legacy game_id but gain canonical activity_id.
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.activities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_activity_id
  ON public.assignments(activity_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student_activity_id
  ON public.assignments(student_id, activity_id)
  WHERE student_id IS NOT NULL AND activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assignments_class_activity_id
  ON public.assignments(class_id, activity_id)
  WHERE class_id IS NOT NULL AND activity_id IS NOT NULL;

-- 2. Activity-native progress keyed by (student_id, activity_id). The version
-- column records the last version played; it does not participate in identity.
CREATE TABLE IF NOT EXISTS public.activity_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  last_version_id UUID REFERENCES public.activity_versions(id) ON DELETE SET NULL,
  legacy_game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'completed')) DEFAULT 'not_started',
  score INTEGER,
  time_spent INTEGER,
  attempts INTEGER DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_progress_student_id
  ON public.activity_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_activity_id
  ON public.activity_progress(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_student_last_played
  ON public.activity_progress(student_id, last_played_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_activity_progress_last_version_id
  ON public.activity_progress(last_version_id);
CREATE INDEX IF NOT EXISTS idx_activity_progress_legacy_game_id
  ON public.activity_progress(legacy_game_id);

DROP TRIGGER IF EXISTS update_activity_progress_updated_at ON public.activity_progress;
CREATE TRIGGER update_activity_progress_updated_at
  BEFORE UPDATE ON public.activity_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. RLS mirrors game_progress but uses SECURITY DEFINER helper functions for
-- cross-table teacher/parent lookups.
ALTER TABLE public.activity_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own activity progress" ON public.activity_progress;
CREATE POLICY "Students can view own activity progress"
  ON public.activity_progress FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own activity progress" ON public.activity_progress;
CREATE POLICY "Students can insert own activity progress"
  ON public.activity_progress FOR INSERT
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update own activity progress" ON public.activity_progress;
CREATE POLICY "Students can update own activity progress"
  ON public.activity_progress FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Teachers can view activity progress in their classes" ON public.activity_progress;
CREATE POLICY "Teachers can view activity progress in their classes"
  ON public.activity_progress FOR SELECT
  USING (student_id IN (SELECT get_teacher_student_ids(auth.uid())));

DROP POLICY IF EXISTS "Teachers can insert activity progress in their classes" ON public.activity_progress;
CREATE POLICY "Teachers can insert activity progress in their classes"
  ON public.activity_progress FOR INSERT
  WITH CHECK (student_id IN (SELECT get_teacher_student_ids(auth.uid())));

DROP POLICY IF EXISTS "Teachers can update activity progress in their classes" ON public.activity_progress;
CREATE POLICY "Teachers can update activity progress in their classes"
  ON public.activity_progress FOR UPDATE
  USING (student_id IN (SELECT get_teacher_student_ids(auth.uid())))
  WITH CHECK (student_id IN (SELECT get_teacher_student_ids(auth.uid())));

DROP POLICY IF EXISTS "Parents can view child activity progress" ON public.activity_progress;
CREATE POLICY "Parents can view child activity progress"
  ON public.activity_progress FOR SELECT
  USING (student_id IN (SELECT get_parent_student_ids(auth.uid())));

DROP POLICY IF EXISTS "Admins can manage activity progress" ON public.activity_progress;
CREATE POLICY "Admins can manage activity progress"
  ON public.activity_progress FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS audit_activity_progress ON public.activity_progress;
CREATE TRIGGER audit_activity_progress
  AFTER INSERT OR UPDATE OR DELETE ON public.activity_progress
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- Preserve the documented teacher write path for legacy progress while the
-- API dual-writes mapped Activity completions back to game_progress.
DROP POLICY IF EXISTS "Teachers can insert game progress in their classes" ON public.game_progress;
CREATE POLICY "Teachers can insert game progress in their classes"
  ON public.game_progress FOR INSERT
  WITH CHECK (student_id IN (SELECT get_teacher_student_ids(auth.uid())));

DROP POLICY IF EXISTS "Teachers can update game progress in their classes" ON public.game_progress;
CREATE POLICY "Teachers can update game progress in their classes"
  ON public.game_progress FOR UPDATE
  USING (student_id IN (SELECT get_teacher_student_ids(auth.uid())))
  WITH CHECK (student_id IN (SELECT get_teacher_student_ids(auth.uid())));

-- 4. Register all shipped Phaser templates. Existing six rows are retained;
-- the newer renderer keys become selectable Activity types without publishing
-- Activity rows by themselves.
INSERT INTO public.activity_types (type_id, display_name, category, config_schema, renderer_key)
VALUES
  ('multiple-choice',  'Multiple Choice',  'quiz',     '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'multiple-choice'),
  ('matching-game',    'Matching Game',    'matching', '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'matching-game'),
  ('memory-game',      'Memory Game',      'memory',   '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'memory-game'),
  ('categorize-game',  'Categorize Game',  'sorting',  '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'categorize-game'),
  ('sequence-order',   'Sequence Order',   'ordering', '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'sequence-order'),
  ('tracing-game',     'Tracing Game',     'creative', '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'tracing-game'),
  ('counting-game',    'Counting Game',    'math',     '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'counting-game'),
  ('pattern-game',     'Pattern Game',     'patterns', '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'pattern-game'),
  ('repeat-sequence',  'Repeat Sequence',  'memory',   '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'repeat-sequence'),
  ('listen-tap',       'Listen & Tap',     'literacy', '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object"}'::jsonb, 'listen-tap')
ON CONFLICT (type_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    renderer_key = EXCLUDED.renderer_key,
    updated_at = NOW();

-- 5. Backfill only proxy-backed legacy games that map to existing published
-- Activity rows. Query-string parsing intentionally requires the exact proxy
-- index path and a game= parameter; unmapped legacy rows remain untouched.
WITH mapped_games AS (
  SELECT
    g.id AS legacy_game_id,
    a.id AS activity_id,
    latest.version_id
  FROM public.games g
  JOIN public.activities a
    ON a.template = substring(g.game_url from '^/api/v1/game-proxy/games/([^/?]+)/index\.html')
   AND a.game_id = substring(g.game_url from '[?&]game=([^&#]+)')
   AND a.status = 'published'
   AND a.is_published = TRUE
  LEFT JOIN LATERAL (
    SELECT av.id AS version_id
    FROM public.activity_versions av
    WHERE av.activity_id = a.id
    ORDER BY av.version_number DESC
    LIMIT 1
  ) latest ON TRUE
  WHERE g.game_url ~ '^/api/v1/game-proxy/games/[^/]+/index\.html(\?|$)'
    AND substring(g.game_url from '[?&]game=([^&#]+)') IS NOT NULL
)
UPDATE public.assignments ass
SET activity_id = COALESCE(ass.activity_id, mapped_games.activity_id),
    version_id = COALESCE(ass.version_id, mapped_games.version_id),
    updated_at = NOW()
FROM mapped_games
WHERE ass.game_id = mapped_games.legacy_game_id
  AND (ass.activity_id IS NULL OR ass.version_id IS NULL);

WITH mapped_games AS (
  SELECT
    g.id AS legacy_game_id,
    a.id AS activity_id,
    latest.version_id
  FROM public.games g
  JOIN public.activities a
    ON a.template = substring(g.game_url from '^/api/v1/game-proxy/games/([^/?]+)/index\.html')
   AND a.game_id = substring(g.game_url from '[?&]game=([^&#]+)')
   AND a.status = 'published'
   AND a.is_published = TRUE
  LEFT JOIN LATERAL (
    SELECT av.id AS version_id
    FROM public.activity_versions av
    WHERE av.activity_id = a.id
    ORDER BY av.version_number DESC
    LIMIT 1
  ) latest ON TRUE
  WHERE g.game_url ~ '^/api/v1/game-proxy/games/[^/]+/index\.html(\?|$)'
    AND substring(g.game_url from '[?&]game=([^&#]+)') IS NOT NULL
)
INSERT INTO public.activity_progress (
  student_id,
  activity_id,
  last_version_id,
  legacy_game_id,
  status,
  score,
  time_spent,
  attempts,
  last_played_at,
  completed_at,
  data,
  created_at,
  updated_at
)
SELECT
  gp.student_id,
  mapped_games.activity_id,
  mapped_games.version_id,
  gp.game_id,
  gp.status,
  gp.score,
  gp.time_spent,
  COALESCE(gp.attempts, 0),
  gp.last_played_at,
  gp.completed_at,
  gp.data,
  gp.created_at,
  gp.updated_at
FROM public.game_progress gp
JOIN mapped_games ON mapped_games.legacy_game_id = gp.game_id
ON CONFLICT (student_id, activity_id) DO UPDATE
SET last_version_id = COALESCE(EXCLUDED.last_version_id, public.activity_progress.last_version_id),
    legacy_game_id = COALESCE(public.activity_progress.legacy_game_id, EXCLUDED.legacy_game_id),
    status = CASE
      WHEN public.activity_progress.status = 'completed' OR EXCLUDED.status = 'completed' THEN 'completed'
      WHEN COALESCE(EXCLUDED.last_played_at, '-infinity'::timestamptz) >= COALESCE(public.activity_progress.last_played_at, '-infinity'::timestamptz) THEN EXCLUDED.status
      ELSE public.activity_progress.status
    END,
    score = CASE
      WHEN COALESCE(EXCLUDED.last_played_at, '-infinity'::timestamptz) >= COALESCE(public.activity_progress.last_played_at, '-infinity'::timestamptz) THEN EXCLUDED.score
      ELSE public.activity_progress.score
    END,
    time_spent = GREATEST(COALESCE(public.activity_progress.time_spent, 0), COALESCE(EXCLUDED.time_spent, 0)),
    attempts = GREATEST(COALESCE(public.activity_progress.attempts, 0), COALESCE(EXCLUDED.attempts, 0)),
    last_played_at = GREATEST(COALESCE(public.activity_progress.last_played_at, '-infinity'::timestamptz), COALESCE(EXCLUDED.last_played_at, '-infinity'::timestamptz)),
    completed_at = COALESCE(public.activity_progress.completed_at, EXCLUDED.completed_at),
    data = CASE
      WHEN COALESCE(EXCLUDED.last_played_at, '-infinity'::timestamptz) >= COALESCE(public.activity_progress.last_played_at, '-infinity'::timestamptz) THEN EXCLUDED.data
      ELSE public.activity_progress.data
    END,
    updated_at = NOW();

COMMENT ON TABLE public.activity_progress IS
  'Activity-native learner progress keyed by (student_id, activity_id). Legacy game_progress remains for compatibility during the games-to-activities migration.';
COMMENT ON COLUMN public.activity_progress.last_version_id IS
  'The Activity Version most recently played for this Activity progress row; not part of row identity.';
COMMENT ON COLUMN public.activity_progress.legacy_game_id IS
  'Temporary bridge pointer to the legacy games row that produced this progress, when one exists.';


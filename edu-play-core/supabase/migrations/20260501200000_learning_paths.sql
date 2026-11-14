-- EDU-31.A (F12 Phase 2A) — Learning Paths v1 schema foundation.
--
-- Four tables that turn EduPlay from a game launcher into a structured
-- learning platform:
--   1. learning_paths              — ordered sequence definitions
--   2. learning_path_steps         — the steps inside a path (linear in v1)
--   3. learning_path_assignments   — paths assigned to a class or single student
--   4. student_path_progress       — per-student traversal state along a path
--
-- One-way doors locked in by the EDU-31 plan §5 (board-approved):
--   - learning_path_steps.target_game_id ON DELETE RESTRICT
--   - student_path_progress UNIQUE (student_id, path_id)
--   - step kind enum ∈ {'game','activity_template'}
--   - linear step order — no branching in v1
--   - no standards-alignment table — Phase 3-4 work
--
-- RLS posture: role-gated writes (EDU-291 pattern) plus roster checks via
-- `get_teacher_class_ids` and `get_teacher_student_ids` (SECURITY DEFINER
-- helpers introduced in 20260327000001 to break circular policy dependencies).
-- Direct (class_id IS NULL, student_id IS NOT NULL) assignments are scoped to
-- the teacher's roster so a teacher cannot grant a path to another teacher's
-- students by skipping the class branch.
--
-- Layout: all tables are created first so cross-table SELECT policies don't
-- forward-reference anything that doesn't exist yet. RLS, policies, indexes,
-- and triggers follow in their own sections.

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS learning_paths (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  age_min       INT,
  age_max       INT,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published','archived')),
  owner_kind    TEXT NOT NULL DEFAULT 'teacher'
                  CHECK (owner_kind IN ('admin','teacher')),
  created_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max)
);

CREATE TABLE IF NOT EXISTS learning_path_steps (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id                UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  step_order             INT NOT NULL,
  kind                   TEXT NOT NULL
                           CHECK (kind IN ('game','activity_template')),
  target_game_id         UUID REFERENCES games(id) ON DELETE RESTRICT,
  target_activity_type   TEXT,
  target_activity_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  title                  TEXT NOT NULL,
  description            TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(path_id, step_order),
  -- Composite UNIQUE on (id, path_id) lets student_path_progress install a
  -- composite FK that enforces step ↔ path co-membership (see below).
  UNIQUE(id, path_id),
  CHECK (
    (kind = 'game'              AND target_game_id IS NOT NULL AND target_activity_type IS NULL) OR
    (kind = 'activity_template' AND target_activity_type IS NOT NULL AND target_game_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS learning_path_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id       UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  class_id      UUID REFERENCES classes(id) ON DELETE CASCADE,
  -- student_id references students(id), not profiles(id), so a teacher /
  -- parent / admin profile cannot end up owning a "student" assignment row.
  -- Mirrors every other student-scoped table in the schema (assignments,
  -- game_progress, parent_children, parent_invite_codes, parent_notifications,
  -- child_artifacts).
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  assigned_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  due_date      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Class XOR student: exactly one target. "At least one" is too loose — a
  -- teacher could insert (class_id = own_class, student_id = arbitrary
  -- external_student); the class branch of the teacher write policy is
  -- satisfied by their own class, but the unrelated student_id then matches
  -- `lpa.student_id = auth.uid()` in the learning_paths SELECT policy and
  -- silently grants path visibility outside the roster. Enforcing XOR forces
  -- the direct-student branch (class_id IS NULL) of the write policy, which
  -- already validates `student_id IN get_teacher_student_ids(auth.uid())`.
  CHECK ((class_id IS NULL) <> (student_id IS NULL))
);

CREATE TABLE IF NOT EXISTS student_path_progress (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- student_id references students(id) so non-student profiles cannot own
  -- progress rows (mirrors learning_path_assignments and the rest of the
  -- schema's student-scoped tables).
  student_id             UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  path_id                UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  current_step_id        UUID,
  last_completed_step_id UUID,
  status                 TEXT NOT NULL DEFAULT 'not_started'
                           CHECK (status IN ('not_started','in_progress','completed','overridden')),
  started_at             TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, path_id),
  -- Composite FKs ensure current/last-completed step references stay within
  -- the same path as `path_id`. ON DELETE SET NULL targets only the step
  -- column so deleting an individual step doesn't null out path_id (NOT NULL).
  CONSTRAINT student_path_progress_current_step_fkey
    FOREIGN KEY (current_step_id, path_id)
    REFERENCES learning_path_steps(id, path_id)
    ON DELETE SET NULL (current_step_id),
  CONSTRAINT student_path_progress_last_completed_step_fkey
    FOREIGN KEY (last_completed_step_id, path_id)
    REFERENCES learning_path_steps(id, path_id)
    ON DELETE SET NULL (last_completed_step_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_learning_paths_created_by ON learning_paths(created_by);
CREATE INDEX IF NOT EXISTS idx_learning_paths_status     ON learning_paths(status);

CREATE INDEX IF NOT EXISTS idx_learning_path_steps_path_id ON learning_path_steps(path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_steps_target_game_id ON learning_path_steps(target_game_id)
  WHERE target_game_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_learning_path_assignments_path_id    ON learning_path_assignments(path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_assignments_class_id   ON learning_path_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_assignments_student_id ON learning_path_assignments(student_id);

CREATE INDEX IF NOT EXISTS idx_student_path_progress_student_id ON student_path_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_path_progress_path_id    ON student_path_progress(path_id);

-- ============================================================================
-- ROW LEVEL SECURITY — enable on all four tables
-- ============================================================================

ALTER TABLE learning_paths              ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_steps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_path_progress       ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES — learning_paths
-- ============================================================================

-- Teacher write boundary: ownership AND verified teacher/admin role. Mirrors
-- the activity_instances / activities pattern (EDU-291) so authenticated
-- non-teacher accounts (notably students, who hold valid `auth.uid()`) cannot
-- create paths by setting `created_by = auth.uid()`. Includes WITH CHECK so
-- INSERT/UPDATE final-state rows are validated, not only existing rows.
DROP POLICY IF EXISTS "Teachers can manage own learning_paths" ON learning_paths;
CREATE POLICY "Teachers can manage own learning_paths" ON learning_paths
  FOR ALL
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
  );

-- Students and teachers can SELECT a path if it's reachable through an
-- assignment they can see (drives the journey-map render). Published paths
-- are also visible to teachers/admins so they can browse the curated library.
DROP POLICY IF EXISTS "Anyone assigned can view learning_paths" ON learning_paths;
CREATE POLICY "Anyone assigned can view learning_paths" ON learning_paths
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM learning_path_assignments lpa
      WHERE lpa.path_id = learning_paths.id
        AND (
          lpa.student_id = auth.uid()
          OR lpa.class_id IN (
            SELECT s.class_id FROM students s WHERE s.id = auth.uid() AND s.class_id IS NOT NULL
          )
          OR lpa.class_id IN (SELECT get_teacher_class_ids(auth.uid()))
        )
    )
    OR (
      status = 'published'
      AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
    )
  );

DROP POLICY IF EXISTS "Admins can manage all learning_paths" ON learning_paths;
CREATE POLICY "Admins can manage all learning_paths" ON learning_paths
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- POLICIES — learning_path_steps
-- ============================================================================

-- Steps inherit visibility from the parent path. Mutations are restricted to
-- whoever can manage the parent path (teacher-owner or admin).
DROP POLICY IF EXISTS "Inherit learning_path visibility for steps" ON learning_path_steps;
CREATE POLICY "Inherit learning_path visibility for steps" ON learning_path_steps
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM learning_paths lp WHERE lp.id = learning_path_steps.path_id)
  );

DROP POLICY IF EXISTS "Path owners manage steps" ON learning_path_steps;
CREATE POLICY "Path owners manage steps" ON learning_path_steps
  FOR ALL
  USING (
    (
      EXISTS (
        SELECT 1 FROM learning_paths lp
        WHERE lp.id = learning_path_steps.path_id
          AND lp.created_by = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin')
      )
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    (
      EXISTS (
        SELECT 1 FROM learning_paths lp
        WHERE lp.id = learning_path_steps.path_id
          AND lp.created_by = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin')
      )
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- POLICIES — learning_path_assignments
-- ============================================================================

-- Teacher assignment boundary:
--   1. Must be a verified teacher/admin (role gate stops a student from
--      inserting `assigned_by = self, student_id = self` to self-grant paths).
--   2. The assignment must be scoped to a class the teacher owns OR a student
--      on the teacher's roster. The previous `auth.uid() = assigned_by`
--      branch let any teacher target any student UUID by setting
--      `class_id = NULL, student_id = <other teacher's student>`, which
--      breaks class-scoped isolation between teachers (immediately granting
--      the target visibility via the `lpa.student_id = auth.uid()` arm of
--      the learning_paths SELECT policy). Roster-scope the direct branch
--      via `get_teacher_student_ids` (SECURITY DEFINER, EDU-291 pattern).
DROP POLICY IF EXISTS "Teachers manage own learning_path_assignments" ON learning_path_assignments;
CREATE POLICY "Teachers manage own learning_path_assignments" ON learning_path_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
    AND (
      class_id IN (SELECT get_teacher_class_ids(auth.uid()))
      OR (
        class_id IS NULL
        AND student_id IN (SELECT get_teacher_student_ids(auth.uid()))
      )
    )
  )
  WITH CHECK (
    auth.uid() = assigned_by
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
    AND (
      class_id IN (SELECT get_teacher_class_ids(auth.uid()))
      OR (
        class_id IS NULL
        AND student_id IN (SELECT get_teacher_student_ids(auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "Students view their learning_path_assignments" ON learning_path_assignments;
CREATE POLICY "Students view their learning_path_assignments" ON learning_path_assignments
  FOR SELECT USING (
    auth.uid() = student_id
    OR class_id IN (
      SELECT s.class_id FROM students s WHERE s.id = auth.uid() AND s.class_id IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "Admins manage all learning_path_assignments" ON learning_path_assignments;
CREATE POLICY "Admins manage all learning_path_assignments" ON learning_path_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- POLICIES — student_path_progress
-- ============================================================================

-- Students can read their own progress, but cannot write path progress rows
-- directly. Progress writes must pass through validating server-side code
-- (teacher overrides today; EDU-31.F auto-progression via trusted server/RPC),
-- so students cannot pre-seed completed/overridden rows for assigned paths.
DROP POLICY IF EXISTS "Students manage own path_progress" ON student_path_progress;
DROP POLICY IF EXISTS "Students view own path_progress" ON student_path_progress;
CREATE POLICY "Students view own path_progress" ON student_path_progress
  FOR SELECT USING (auth.uid() = student_id);

-- Teachers see / override progress for paths they own or for students in
-- their classes. Role gate prevents a student from inserting a fake
-- "teacher-override" progress row by claiming ownership of a path they
-- didn't create (defense-in-depth alongside the learning_paths write gate).
DROP POLICY IF EXISTS "Teachers view + override class path_progress" ON student_path_progress;
CREATE POLICY "Teachers view + override class path_progress" ON student_path_progress
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
    AND (
      EXISTS (
        SELECT 1 FROM learning_paths lp
        WHERE lp.id = student_path_progress.path_id
          AND lp.created_by = auth.uid()
      )
      OR student_id IN (SELECT get_teacher_student_ids(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin')
    )
    AND (
      EXISTS (
        SELECT 1 FROM learning_paths lp
        WHERE lp.id = student_path_progress.path_id
          AND lp.created_by = auth.uid()
      )
      OR student_id IN (SELECT get_teacher_student_ids(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Admins manage all path_progress" ON student_path_progress;
CREATE POLICY "Admins manage all path_progress" ON student_path_progress
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- TRIGGERS — updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_learning_paths_updated_at ON learning_paths;
CREATE TRIGGER update_learning_paths_updated_at
  BEFORE UPDATE ON learning_paths
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_path_progress_updated_at ON student_path_progress;
CREATE TRIGGER update_student_path_progress_updated_at
  BEFORE UPDATE ON student_path_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

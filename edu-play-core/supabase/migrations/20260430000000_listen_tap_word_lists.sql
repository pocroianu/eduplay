-- EDU-198: Listen-and-Tap word list persistence
-- Per-teacher word list storage for the listen-tap Phaser template.
--   - Teachers (owners) can CRUD their own lists.
--   - Authenticated readers can SELECT (the iframe game-config fetch on
--     /api/v1/teacher/listen-tap/word-lists/:id is invoked by both teachers
--     authoring lists and students playing assigned activities).

-- ---------------------------------------------------------------------------
-- 1. listen_tap_word_lists
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS listen_tap_word_lists (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_teacher_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  language          TEXT NOT NULL DEFAULT 'ro' CHECK (language IN ('ro', 'en')),
  words             JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT listen_tap_word_lists_words_is_array
    CHECK (jsonb_typeof(words) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_listen_tap_word_lists_owner_teacher_id
  ON listen_tap_word_lists(owner_teacher_id);

COMMENT ON TABLE listen_tap_word_lists IS
  'Teacher-authored word lists for the listen-and-tap game template (EDU-64).';
COMMENT ON COLUMN listen_tap_word_lists.words IS
  'Ordered array of { word: string, promptAudioId: string, imageAssetId?: string }.';

-- ---------------------------------------------------------------------------
-- 2. updated_at trigger (reuses existing helper from initial_schema)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS update_listen_tap_word_lists_updated_at ON listen_tap_word_lists;
CREATE TRIGGER update_listen_tap_word_lists_updated_at
  BEFORE UPDATE ON listen_tap_word_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE listen_tap_word_lists ENABLE ROW LEVEL SECURITY;

-- Read: any authenticated user (teachers see their own + peers' lists when
-- assigned, students read assigned-list config from the iframe). Server-side
-- API filters narrow this to the caller's role-appropriate scope.
DROP POLICY IF EXISTS "Authenticated read listen_tap_word_lists" ON listen_tap_word_lists;
CREATE POLICY "Authenticated read listen_tap_word_lists" ON listen_tap_word_lists
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert: only the owner teacher can claim a list.
DROP POLICY IF EXISTS "Owner inserts listen_tap_word_lists" ON listen_tap_word_lists;
CREATE POLICY "Owner inserts listen_tap_word_lists" ON listen_tap_word_lists
  FOR INSERT
  WITH CHECK (
    owner_teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'teacher'
    )
  );

-- Update: only the owner teacher.
DROP POLICY IF EXISTS "Owner updates listen_tap_word_lists" ON listen_tap_word_lists;
CREATE POLICY "Owner updates listen_tap_word_lists" ON listen_tap_word_lists
  FOR UPDATE
  USING (owner_teacher_id = auth.uid())
  WITH CHECK (owner_teacher_id = auth.uid());

-- Delete: only the owner teacher.
DROP POLICY IF EXISTS "Owner deletes listen_tap_word_lists" ON listen_tap_word_lists;
CREATE POLICY "Owner deletes listen_tap_word_lists" ON listen_tap_word_lists
  FOR DELETE
  USING (owner_teacher_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- ---------------------------------------------------------------------------
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260430000000''';
  END IF;
END
$wa$;

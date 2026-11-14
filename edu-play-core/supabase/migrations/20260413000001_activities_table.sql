-- Activities table: stores game/activity definitions
CREATE TABLE IF NOT EXISTS activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template        TEXT NOT NULL,
  game_id         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  thumbnail_url   TEXT,
  default_lang    TEXT NOT NULL DEFAULT 'ro',
  default_theme   TEXT,
  category        TEXT,
  difficulty      TEXT DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  target_age_min  INTEGER,
  target_age_max  INTEGER,
  estimated_duration INTEGER,
  question_count  INTEGER,
  tags            TEXT[] DEFAULT '{}',
  subject         TEXT,
  skills          TEXT[] DEFAULT '{}',
  is_published    BOOLEAN DEFAULT FALSE,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template, game_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activities_template ON activities(template);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);
CREATE INDEX IF NOT EXISTS idx_activities_published ON activities(is_published);
CREATE INDEX IF NOT EXISTS idx_activities_tags ON activities USING GIN(tags);

-- RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published activities" ON activities;
CREATE POLICY "Anyone can view published activities"
  ON activities FOR SELECT
  USING (is_published = TRUE);

DROP POLICY IF EXISTS "Admins can manage activities" ON activities;
CREATE POLICY "Admins can manage activities"
  ON activities FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')));

-- Trigger: reuse existing update_updated_at_column()
DROP TRIGGER IF EXISTS update_activities_updated_at ON activities;
CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
-- Remove pre-existing tracking row so the CLI's final INSERT can succeed.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260413000001''';
  END IF;
END
$wa$;

-- EDU-295: Per-child consent map for creative-activity gating.
--
-- Stores parent-granted consent flags as a JSONB map keyed by the
-- TypeScript `ConsentKey` union ('audio_recording', 'photo_capture',
-- 'video_capture'). The activity-type registry (EDU-302) reads this map
-- via `resolveConsentGate` to render the kid-mode permission empty state
-- when consent is missing.
--
-- Storage choice: a JSONB column on `students` rather than a dedicated
-- table. Trade-offs the PR documents:
--   * Pro: a single row read fans out all consent flags; the existing
--     `audit_students` trigger automatically captures every change with
--     `old_data`/`new_data` so we get the EDU-295 audit requirement for
--     free; matches the `ConsentMap = Partial<Record<ConsentKey, boolean>>`
--     shape exposed by EDU-302.
--   * Con: a dedicated table would let us index per-flag queries; we don't
--     have those today (the only consumer is the per-student page route).
--
-- Mutation path: parents call the SECURITY DEFINER `set_child_consent`
-- function rather than UPDATE-ing `students` directly. The function
-- gates on the `parent_children` link so we don't have to introduce a
-- column-scoped UPDATE policy that would inadvertently let parents
-- mutate `class_id` or `username` alongside the consent map.

-- 1. Add the consent map column.
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS consents JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN students.consents IS
  'Parent-granted consent flags keyed by ConsentKey (EDU-302). Default off; only true counts as granted. Mutated via set_child_consent() RPC.';

-- 2. Defense-in-depth column gate. RLS is row-scoped, so the broad teacher
-- UPDATE policy for class students would otherwise allow direct writes to
-- students.consents via PostgREST. Only the parent RPC below sets the local
-- transaction flag this trigger accepts; service-role/server migrations bypass
-- with auth.uid() IS NULL.
CREATE OR REPLACE FUNCTION public.enforce_parent_only_student_consents()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF current_setting('eduplay.allow_child_consent_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.consents IS DISTINCT FROM OLD.consents THEN
    RAISE EXCEPTION 'students.consents is parent-only'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS students_consents_parent_only ON students;
CREATE TRIGGER students_consents_parent_only
  BEFORE UPDATE OF consents ON students
  FOR EACH ROW EXECUTE FUNCTION public.enforce_parent_only_student_consents();

COMMENT ON FUNCTION public.enforce_parent_only_student_consents() IS
  'Rejects direct authenticated writes to students.consents so parent consent remains parent-controlled despite row-level teacher UPDATE policies. EDU-295.';

-- 3. RPC for parents to flip a single consent flag.
CREATE OR REPLACE FUNCTION public.set_child_consent(
  p_child_id UUID,
  p_consent_key TEXT,
  p_value BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link_count INT;
  v_caller_role TEXT;
BEGIN
  -- Mirror the TS ConsentKey union — reject keys we don't recognize so a
  -- typo doesn't quietly grow the consent map.
  IF p_consent_key NOT IN ('audio_recording', 'photo_capture', 'video_capture') THEN
    RAISE EXCEPTION 'Cheia de consimtamant nu este recunoscuta: %', p_consent_key
      USING ERRCODE = 'check_violation';
  END IF;

  -- Caller must be a parent profile, not merely any authenticated user with
  -- a parent_children row.
  SELECT role INTO v_caller_role
  FROM profiles
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'parent' THEN
    RAISE EXCEPTION 'Doar parintii pot modifica consimtamantul copilului'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Caller must also be the active parent for this child. The audit trigger
  -- on `students` records auth.uid() (the parent), so audit attribution is
  -- correct even though this function is SECURITY DEFINER.
  SELECT COUNT(*) INTO v_link_count
  FROM parent_children
  WHERE parent_id = auth.uid()
    AND student_id = p_child_id
    AND status = 'active';

  IF v_link_count = 0 THEN
    RAISE EXCEPTION 'Nu ai permisiunea sa modifici consimtamantul pentru acest copil'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM set_config('eduplay.allow_child_consent_update', 'on', true);

  UPDATE students
  SET consents = jsonb_set(
        coalesce(consents, '{}'::jsonb),
        ARRAY[p_consent_key],
        to_jsonb(p_value),
        TRUE
      ),
      updated_at = NOW()
  WHERE id = p_child_id;

  PERFORM set_config('eduplay.allow_child_consent_update', 'off', true);
END;
$$;

COMMENT ON FUNCTION public.set_child_consent(UUID, TEXT, BOOLEAN) IS
  'Parent-only RPC that flips a single consent flag on the child profile. Gated on an active parent_children link.';

REVOKE ALL ON FUNCTION public.set_child_consent(UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_child_consent(UUID, TEXT, BOOLEAN) TO authenticated;

-- Workaround for Supabase CLI duplicate schema_migrations row issue.
DO $wa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'
  ) THEN
    EXECUTE 'DELETE FROM supabase_migrations.schema_migrations WHERE version = ''20260502000001''';
  END IF;
END
$wa$;

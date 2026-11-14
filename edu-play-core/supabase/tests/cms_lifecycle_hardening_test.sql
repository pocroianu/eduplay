-- ============================================================================
-- EDU-533 — CMS lifecycle hardening tests
-- ----------------------------------------------------------------------------
-- Covers the two P2 follow-ups from PR #158:
--   Finding 1: teachers cannot flip readiness/scope/owner lifecycle columns,
--              while owned private drafts may store config data for teacher
--              authoring.
--   Finding 2: activity_versions has its own renderer pin (activity_type_id)
--              so the rendered template stays stable when activities.template
--              is later edited.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

-- ----------------------------------------------------------------------------
-- Schema-level assertions (Finding 2)
-- ----------------------------------------------------------------------------

SELECT has_column(
  'public', 'activity_versions', 'activity_type_id',
  'activity_versions.activity_type_id added'
);

SELECT col_not_null(
  'public', 'activity_versions', 'activity_type_id',
  'activity_versions.activity_type_id is NOT NULL'
);

SELECT col_is_fk(
  'public', 'activity_versions', 'activity_type_id',
  'activity_versions.activity_type_id is a foreign key to activity_types'
);

-- ----------------------------------------------------------------------------
-- Fixtures
-- ----------------------------------------------------------------------------

SET LOCAL row_security = on;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'cms533-admin-test@example.com',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-4444-444444444444', 'cms533-teacher-test@example.com','00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'cms533-admin-test@example.com',   'CMS-533 Admin Test',   'admin'),
  ('44444444-4444-4444-4444-444444444444', 'cms533-teacher-test@example.com', 'CMS-533 Teacher Test', 'teacher')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO activities (id, template, title, status, is_published, visibility_scope, created_by, config_data, config_schema_version)
VALUES
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'multiple-choice', 'Pub-533',   'published', TRUE,  'public',  '33333333-3333-3333-3333-333333333333', '{"draft":1}'::jsonb, 1),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'matching-game',   'Draft-533', 'draft',     FALSE, 'private', '44444444-4444-4444-4444-444444444444', NULL,                  NULL);

INSERT INTO activity_versions (id, activity_id, version_number, config_data, config_schema_version, activity_type_id, published_by_user_id)
VALUES
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 1, '{"v":1}'::jsonb, 1, 'multiple-choice', NULL);

-- ----------------------------------------------------------------------------
-- Finding 1 — Teacher cannot flip lifecycle columns via direct Supabase
-- ----------------------------------------------------------------------------

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"44444444-4444-4444-4444-444444444444"}';

UPDATE activities
SET status = 'archived'
WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
SELECT is(
  (SELECT status FROM activities WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'),
  'published',
  'teacher cannot UPDATE activities.status on public catalog rows'
);

UPDATE activities
SET config_data = '{"hijacked":true}'::jsonb
WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
SELECT is(
  (SELECT config_data FROM activities WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'),
  '{"draft": 1}'::jsonb,
  'teacher cannot UPDATE activities.config_data on public catalog rows'
);

UPDATE activities
SET config_schema_version = 9
WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
SELECT is(
  (SELECT config_schema_version FROM activities WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'),
  1,
  'teacher cannot UPDATE activities.config_schema_version on public catalog rows'
);

-- Sanity check: a teacher cannot update even non-lifecycle columns on public
-- catalog rows they do not own.
UPDATE activities SET title = 'Pub-533 retitled by teacher'
WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

SELECT is(
  (SELECT title FROM activities WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'),
  'Pub-533',
  'teacher cannot update public catalog activities they do not own'
);

-- ----------------------------------------------------------------------------
-- Finding 1 (INSERT) — Teacher cannot create rows with lifecycle values set
-- ----------------------------------------------------------------------------
-- Teacher inserts must stay owned/private/draft, but may include draft config
-- for teacher-created Activity authoring.

PREPARE teacher_insert_published AS
  INSERT INTO activities (template, title, status)
  VALUES ('multiple-choice', 'Teacher pub attempt', 'published');
SELECT throws_ok(
  'teacher_insert_published',
  '42501',
  NULL,
  'teacher cannot INSERT activities with status=''published'' via direct Supabase'
);

INSERT INTO activities (id, template, title, created_by, visibility_scope, config_data, config_schema_version)
VALUES (
  'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
  'multiple-choice',
  'Teacher cfg draft',
  '44444444-4444-4444-4444-444444444444',
  'private',
  '{"x":1}'::jsonb,
  1
);
SELECT is(
  (SELECT config_data FROM activities WHERE id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'),
  '{"x": 1}'::jsonb,
  'teacher CAN INSERT owned private drafts with config_data and schema version'
);

UPDATE activities
SET config_data = '{"x":2}'::jsonb, config_schema_version = 2
WHERE id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
SELECT is(
  (SELECT config_schema_version FROM activities WHERE id = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'),
  2,
  'teacher CAN UPDATE config fields on owned private drafts'
);

-- Sanity check: a teacher inserting an owned private row with schema defaults
-- still succeeds.
INSERT INTO activities (id, template, title, created_by, visibility_scope)
VALUES ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'multiple-choice', 'Teacher default insert', '44444444-4444-4444-4444-444444444444', 'private');

SELECT is(
  (SELECT status FROM activities WHERE id = 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1'),
  'draft',
  'teacher CAN still INSERT activities with schema defaults (status defaults to draft)'
);

-- ----------------------------------------------------------------------------
-- Admin can flip lifecycle columns
-- ----------------------------------------------------------------------------

SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333"}';

UPDATE activities SET status = 'archived'
WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

SELECT is(
  (SELECT status FROM activities WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'),
  'archived',
  'admin CAN UPDATE activities.status'
);

-- Restore so later assertions see the published activity.
UPDATE activities SET status = 'published'
WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

-- ----------------------------------------------------------------------------
-- Finding 2 — Renderer for a pinned version stays stable when parent
-- activities.template is edited
-- ----------------------------------------------------------------------------

-- Snapshot the pinned renderer BEFORE the parent's template changes.
SELECT is(
  (SELECT activity_type_id FROM activity_versions WHERE id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'),
  'multiple-choice',
  'pinned activity_versions.activity_type_id starts as multiple-choice'
);

-- Admin re-templates the parent activity. (`template` is not a lifecycle
-- column gated by EDU-533; it is teacher-writable today, but the test uses
-- admin to side-step any future tightening so the assertion is about the
-- snapshot contract, not the column gate.)
UPDATE activities SET template = 'matching-game'
WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';

SELECT is(
  (SELECT template FROM activities WHERE id = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1'),
  'matching-game',
  'parent activities.template was updated to matching-game'
);

-- The pinned version still resolves to the original renderer.
SELECT is(
  (SELECT activity_type_id FROM activity_versions WHERE id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'),
  'multiple-choice',
  'pinned activity_versions.activity_type_id stays multiple-choice after parent template edit'
);

-- The renderer_key resolved through activity_types matches the pin, not the
-- (now-changed) parent template. This is the contract EDU-476 will rely on.
SELECT is(
  (
    SELECT t.renderer_key
    FROM activity_versions v
    JOIN activity_types t ON t.type_id = v.activity_type_id
    WHERE v.id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'
  ),
  'multiple-choice',
  'renderer_key resolved through version row stays stable across parent template edits'
);

-- ----------------------------------------------------------------------------
-- Migration safety — activity_versions_immutable trigger stays enabled
-- ----------------------------------------------------------------------------
-- The 20260508 migration disables `activity_versions_immutable` while
-- backfilling `activity_type_id` and re-enables it before commit. If the
-- ENABLE TRIGGER step is ever lost, snapshot immutability silently breaks.
-- Run a privileged UPDATE here and assert it still RAISEs, confirming the
-- trigger survived the data migration.

RESET ROLE;
RESET "request.jwt.claims";

PREPARE post_migration_immutability AS
  UPDATE activity_versions
  SET config_data = '{"tampered":true}'::jsonb
  WHERE id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1';
SELECT throws_ok(
  'post_migration_immutability',
  NULL,
  'activity_versions rows are immutable; insert a new version_number instead',
  'activity_versions_immutable trigger remains enabled after EDU-533 backfill'
);

-- ----------------------------------------------------------------------------
-- Wrap up
-- ----------------------------------------------------------------------------

SELECT * FROM finish();

ROLLBACK;

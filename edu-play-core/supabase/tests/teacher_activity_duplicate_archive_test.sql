-- ============================================================================
-- Teacher-created Activity duplicate/archive lifecycle.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(24);

SELECT has_function(
  'public',
  'duplicate_teacher_activity_atomically',
  ARRAY['uuid', 'uuid'],
  'teacher private duplicate RPC exists'
);
SELECT has_function(
  'public',
  'archive_teacher_activity_atomically',
  ARRAY['uuid', 'uuid'],
  'teacher private archive RPC exists'
);
SELECT has_function(
  'public',
  'restore_teacher_activity_atomically',
  ARRAY['uuid', 'uuid'],
  'teacher private restore RPC exists'
);

SET LOCAL row_security = on;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('51515151-5151-5151-8151-515151515151', 'duplicate-teacher-a@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('52525252-5252-5252-8252-525252525252', 'duplicate-teacher-b@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('53535353-5353-5353-8353-535353535353', 'duplicate-student@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
VALUES
  ('51515151-5151-5151-8151-515151515151', 'duplicate-teacher-a@example.com', 'Duplicate Teacher A', 'teacher'),
  ('52525252-5252-5252-8252-525252525252', 'duplicate-teacher-b@example.com', 'Duplicate Teacher B', 'teacher'),
  ('53535353-5353-5353-8353-535353535353', 'duplicate-student@example.com', 'Duplicate Student', 'student')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO classes (id, teacher_id, name)
VALUES ('54545454-5454-5454-8454-545454545454', '51515151-5151-5151-8151-515151515151', 'Duplicate Class');

INSERT INTO students (id, class_id, username)
VALUES ('53535353-5353-5353-8353-535353535353', '54545454-5454-5454-8454-545454545454', 'duplicate-student');

INSERT INTO activities (id, template, title, description, status, is_published, visibility_scope, created_by, config_data, config_schema_version)
VALUES
  (
    '55555555-5555-5555-8555-555555555555',
    'free-response',
    'Activitate de copiat',
    'Instrucțiuni pentru copiere',
    'published',
    TRUE,
    'private',
    '51515151-5151-5151-8151-515151515151',
    '{"prompt":"Copiază configurația.","allowedTools":{"text":true,"drawing":true,"voice":false},"shareWithFamilyOnApproval":true}'::jsonb,
    1
  ),
  (
    '56565656-5656-5656-8565-565656565656',
    'free-response',
    'Activitatea altui profesor',
    'Nu se poate copia',
    'draft',
    FALSE,
    'private',
    '52525252-5252-5252-8252-525252525252',
    '{"prompt":"Alta.","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1
  );

INSERT INTO activity_versions (id, activity_id, version_number, config_data, config_schema_version, activity_type_id, published_by_user_id)
VALUES (
  '57575757-5757-5757-8575-575757575757',
  '55555555-5555-5555-8555-555555555555',
  1,
  '{"prompt":"Configurație publicată veche.","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
  1,
  'free-response',
  '51515151-5151-5151-8151-515151515151'
);

INSERT INTO activity_resources (id, activity_id, version_id, resource_type, title, url, sort_order, created_by)
VALUES (
  '58585858-5858-5858-8585-585858585858',
  '55555555-5555-5555-8555-555555555555',
  NULL,
  'link',
  'Resursă live',
  'https://example.test/live',
  1,
  '51515151-5151-5151-8151-515151515151'
);

SELECT set_config('app.allow_activity_resource_snapshot_insert', 'on', TRUE);
INSERT INTO activity_resources (id, activity_id, version_id, resource_type, title, url, sort_order, created_by)
VALUES (
  '59595959-5959-5959-8595-595959595959',
  '55555555-5555-5555-8555-555555555555',
  '57575757-5757-5757-8575-575757575757',
  'link',
  'Resursă versionată',
  'https://example.test/versionata',
  1,
  '51515151-5151-5151-8151-515151515151'
);
SELECT set_config('app.allow_activity_resource_snapshot_insert', 'off', TRUE);

INSERT INTO assignments (id, teacher_id, class_id, activity_id, version_id)
VALUES (
  '60606060-6060-6060-8060-606060606060',
  '51515151-5151-5151-8151-515151515151',
  '54545454-5454-5454-8454-545454545454',
  '55555555-5555-5555-8555-555555555555',
  '57575757-5757-5757-8575-575757575757'
);

INSERT INTO activity_submissions (id, assignment_id, student_id, activity_id, version_id, status, latest_response)
VALUES (
  '61616161-6161-6161-8161-616161616161',
  '60606060-6060-6060-8060-606060606060',
  '53535353-5353-5353-8353-535353535353',
  '55555555-5555-5555-8555-555555555555',
  '57575757-5757-5757-8575-575757575757',
  'draft',
  '{"text":"răspuns"}'::jsonb
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"51515151-5151-5151-8151-515151515151"}';

PREPARE authenticated_duplicate_call AS
  SELECT public.duplicate_teacher_activity_atomically(
    '55555555-5555-5555-8555-555555555555',
    '51515151-5151-5151-8151-515151515151'
  );
SELECT throws_ok('authenticated_duplicate_call', '42501', NULL, 'authenticated teachers cannot execute duplicate RPC directly');

PREPARE authenticated_archive_call AS
  SELECT public.archive_teacher_activity_atomically(
    '55555555-5555-5555-8555-555555555555',
    '51515151-5151-5151-8151-515151515151'
  );
SELECT throws_ok('authenticated_archive_call', '42501', NULL, 'authenticated teachers cannot execute archive RPC directly');

PREPARE authenticated_restore_call AS
  SELECT public.restore_teacher_activity_atomically(
    '55555555-5555-5555-8555-555555555555',
    '51515151-5151-5151-8151-515151515151'
  );
SELECT throws_ok('authenticated_restore_call', '42501', NULL, 'authenticated teachers cannot execute restore RPC directly');

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE service_role;
SET LOCAL "request.jwt.claims" = '{"role":"service_role"}';

CREATE TEMP TABLE duplicate_result AS
SELECT public.duplicate_teacher_activity_atomically(
  '55555555-5555-5555-8555-555555555555',
  '51515151-5151-5151-8151-515151515151'
) AS payload;

SELECT is(
  (SELECT status FROM activities WHERE id = ((SELECT payload->'activity'->>'id' FROM duplicate_result)::uuid)),
  'draft',
  'duplicate creates a new draft activity'
);

SELECT is(
  (SELECT visibility_scope FROM activities WHERE id = ((SELECT payload->'activity'->>'id' FROM duplicate_result)::uuid)),
  'private',
  'duplicate remains private'
);

SELECT ok(
  NOT (SELECT COALESCE(is_published, TRUE) FROM activities WHERE id = ((SELECT payload->'activity'->>'id' FROM duplicate_result)::uuid)),
  'duplicate is not ready/published'
);

SELECT is(
  (SELECT config_data FROM activities WHERE id = ((SELECT payload->'activity'->>'id' FROM duplicate_result)::uuid)),
  '{"prompt":"Copiază configurația.","allowedTools":{"text":true,"drawing":true,"voice":false},"shareWithFamilyOnApproval":true}'::jsonb,
  'duplicate copies the editable live config, not the old version config'
);

SELECT is(
  (SELECT url FROM activity_resources WHERE activity_id = ((SELECT payload->'activity'->>'id' FROM duplicate_result)::uuid) AND version_id IS NULL AND sort_order = 1),
  'https://example.test/live',
  'duplicate copies live resources'
);

SELECT is(
  (SELECT count(*) FROM activity_resources WHERE activity_id = ((SELECT payload->'activity'->>'id' FROM duplicate_result)::uuid) AND version_id IS NOT NULL),
  0::bigint,
  'duplicate does not copy versioned resource snapshots'
);

SELECT is(
  (SELECT count(*) FROM activity_versions WHERE activity_id = ((SELECT payload->'activity'->>'id' FROM duplicate_result)::uuid)),
  0::bigint,
  'duplicate does not copy version history'
);

SELECT is(
  (SELECT count(*) FROM assignments WHERE activity_id = ((SELECT payload->'activity'->>'id' FROM duplicate_result)::uuid)),
  0::bigint,
  'duplicate does not copy assignments'
);

SELECT is(
  (SELECT count(*) FROM activity_submissions WHERE activity_id = ((SELECT payload->'activity'->>'id' FROM duplicate_result)::uuid)),
  0::bigint,
  'duplicate does not copy submissions'
);

SELECT public.archive_teacher_activity_atomically(
  '55555555-5555-5555-8555-555555555555',
  '51515151-5151-5151-8151-515151515151'
);

SELECT is(
  (SELECT status FROM activities WHERE id = '55555555-5555-5555-8555-555555555555'),
  'archived',
  'archive marks the original activity archived'
);

SELECT ok(
  (SELECT COALESCE(is_published, FALSE) FROM activities WHERE id = '55555555-5555-5555-8555-555555555555'),
  'archive keeps ready activity is_published=true so existing pinned assignment config can still load'
);

SELECT is(
  (SELECT count(*) FROM assignments WHERE activity_id = '55555555-5555-5555-8555-555555555555' AND version_id = '57575757-5757-5757-8575-575757575757'),
  1::bigint,
  'archive does not delete or repoint existing assignments'
);

SELECT public.restore_teacher_activity_atomically(
  '55555555-5555-5555-8555-555555555555',
  '51515151-5151-5151-8151-515151515151'
);

SELECT is(
  (SELECT status FROM activities WHERE id = '55555555-5555-5555-8555-555555555555'),
  'published',
  'restore returns a ready archived activity to active ready status'
);

SELECT ok(
  (SELECT COALESCE(is_published, FALSE) FROM activities WHERE id = '55555555-5555-5555-8555-555555555555'),
  'restore keeps ready activity is_published=true'
);

SELECT is(
  (SELECT count(*) FROM assignments WHERE activity_id = '55555555-5555-5555-8555-555555555555' AND version_id = '57575757-5757-5757-8575-575757575757'),
  1::bigint,
  'restore does not delete or repoint existing assignments'
);

PREPARE non_owner_duplicate_call AS
  SELECT public.duplicate_teacher_activity_atomically(
    '55555555-5555-5555-8555-555555555555',
    '52525252-5252-5252-8252-525252525252'
  );
SELECT throws_ok('non_owner_duplicate_call', '42501', NULL, 'duplicate RPC rejects non-owner teachers');

PREPARE non_owner_archive_call AS
  SELECT public.archive_teacher_activity_atomically(
    '55555555-5555-5555-8555-555555555555',
    '52525252-5252-5252-8252-525252525252'
  );
SELECT throws_ok('non_owner_archive_call', '42501', NULL, 'archive RPC rejects non-owner teachers');

PREPARE non_owner_restore_call AS
  SELECT public.restore_teacher_activity_atomically(
    '55555555-5555-5555-8555-555555555555',
    '52525252-5252-5252-8252-525252525252'
  );
SELECT throws_ok('non_owner_restore_call', '42501', NULL, 'restore RPC rejects non-owner teachers');

RESET ROLE;
RESET "request.jwt.claims";

SELECT * FROM finish();

ROLLBACK;

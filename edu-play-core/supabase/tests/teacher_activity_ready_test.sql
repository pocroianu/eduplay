-- ============================================================================
-- Teacher-created Activity ready flow: private ready snapshots.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(22);

SELECT has_function(
  'public',
  'make_teacher_activity_ready_atomically',
  ARRAY['uuid', 'text', 'jsonb', 'integer', 'uuid', 'text', 'boolean', 'integer'],
  'teacher private ready RPC exists'
);
SELECT has_table('public', 'activity_resources', 'activity_resources table exists');

SET LOCAL row_security = on;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('77777777-7777-7777-7777-777777777777', 'admin-ready@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('88888888-8888-8888-8888-888888888888', 'teacher-ready-a@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('99999999-9999-9999-9999-999999999999', 'teacher-ready-b@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
VALUES
  ('77777777-7777-7777-7777-777777777777', 'admin-ready@example.com', 'Admin Ready', 'admin'),
  ('88888888-8888-8888-8888-888888888888', 'teacher-ready-a@example.com', 'Teacher Ready A', 'teacher'),
  ('99999999-9999-9999-9999-999999999999', 'teacher-ready-b@example.com', 'Teacher Ready B', 'teacher')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO activities (id, template, title, status, is_published, visibility_scope, created_by, config_data, config_schema_version)
VALUES
  (
    '81818181-8181-8181-8181-818181818181',
    'free-response',
    'Teacher ready draft',
    'draft',
    FALSE,
    'private',
    '88888888-8888-8888-8888-888888888888',
    '{"prompt":"Scrie prima variantă.","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1
  ),
  (
    '82828282-8282-8282-8282-828282828282',
    'free-response',
    'Invalid ready draft',
    'draft',
    FALSE,
    'private',
    '88888888-8888-8888-8888-888888888888',
    '{"prompt":" ","allowedTools":{"text":false,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1
  );

INSERT INTO activity_resources (id, activity_id, version_id, resource_type, title, url, sort_order, created_by)
VALUES (
  '83838383-8383-8383-8383-838383838383',
  '81818181-8181-8181-8181-818181818181',
  NULL,
  'link',
  'Prima resursă',
  'https://example.test/prima',
  1,
  '88888888-8888-8888-8888-888888888888'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"88888888-8888-8888-8888-888888888888"}';

PREPARE authenticated_ready_call AS
  SELECT public.make_teacher_activity_ready_atomically(
    '81818181-8181-8181-8181-818181818181',
    'free-response',
    '{"prompt":"Scrie prima variantă.","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1,
    '88888888-8888-8888-8888-888888888888',
    'draft',
    FALSE,
    1
  );
SELECT throws_ok('authenticated_ready_call', '42501', NULL, 'authenticated teachers cannot execute the service-role-only ready RPC directly');

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE service_role;
SET LOCAL "request.jwt.claims" = '{"role":"service_role"}';

CREATE TEMP TABLE first_ready_result AS
SELECT public.make_teacher_activity_ready_atomically(
  '81818181-8181-8181-8181-818181818181',
  'free-response',
  '{"prompt":"Scrie prima variantă.","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
  1,
  '88888888-8888-8888-8888-888888888888',
  'draft',
  FALSE,
  1
) AS payload;

SELECT is(
  (SELECT status FROM activities WHERE id = '81818181-8181-8181-8181-818181818181'),
  'published',
  'ready RPC marks the activity status as published for assignability'
);

SELECT ok(
  (SELECT COALESCE(is_published, FALSE) FROM activities WHERE id = '81818181-8181-8181-8181-818181818181'),
  'ready RPC sets is_published=true for assignability'
);

SELECT is(
  (SELECT visibility_scope FROM activities WHERE id = '81818181-8181-8181-8181-818181818181'),
  'private',
  'ready RPC keeps teacher-created activities private'
);

SELECT is(
  (SELECT count(*) FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181'),
  1::bigint,
  'ready RPC creates one immutable version snapshot'
);

SELECT is(
  (SELECT config_data->>'prompt' FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181' AND version_number = 1),
  'Scrie prima variantă.',
  'version snapshot stores the ready config'
);

SELECT is(
  (SELECT title FROM activity_resources WHERE version_id = (SELECT id FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181' AND version_number = 1) AND sort_order = 1),
  'Prima resursă',
  'ready RPC snapshots ordered live resources onto the version'
);

CREATE TEMP TABLE duplicate_ready_result AS
SELECT public.make_teacher_activity_ready_atomically(
  '81818181-8181-8181-8181-818181818181',
  'free-response',
  '{"prompt":"Scrie prima variantă.","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
  1,
  '88888888-8888-8888-8888-888888888888',
  'published',
  TRUE,
  1
) AS payload;

SELECT is(
  (SELECT count(*) FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181'),
  1::bigint,
  'repeat ready with identical config reuses the latest version instead of duplicating it'
);

SELECT is(
  (SELECT payload->'version'->>'id' FROM duplicate_ready_result),
  (SELECT payload->'version'->>'id' FROM first_ready_result),
  'repeat ready returns the existing identical version'
);

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"77777777-7777-7777-7777-777777777777"}';

PREPARE mutate_version_resource AS
  UPDATE activity_resources
     SET url = 'https://example.test/hacked'
   WHERE version_id = (SELECT id FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181' AND version_number = 1);
SELECT throws_ok('mutate_version_resource', '23514', NULL, 'versioned resource snapshots are immutable even for admins');

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE service_role;
SET LOCAL "request.jwt.claims" = '{"role":"service_role"}';

PREPARE service_role_mutate_version_resource AS
  UPDATE activity_resources
     SET url = 'https://example.test/service-role-hacked'
   WHERE version_id = (SELECT id FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181' AND version_number = 1);
SELECT throws_ok('service_role_mutate_version_resource', '23514', NULL, 'versioned resource snapshots are immutable even for service role');

PREPARE service_role_append_version_resource AS
  INSERT INTO activity_resources (activity_id, version_id, resource_type, title, url, sort_order, created_by)
  VALUES (
    '81818181-8181-8181-8181-818181818181',
    (SELECT id FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181' AND version_number = 1),
    'link',
    'Resursă inserată direct',
    'https://example.test/append',
    2,
    '88888888-8888-8888-8888-888888888888'
  );
SELECT throws_ok('service_role_append_version_resource', '42501', NULL, 'service role cannot append resources to an existing version outside the ready RPC');

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"88888888-8888-8888-8888-888888888888"}';

UPDATE activities
   SET config_data = '{"prompt":"Scrie a doua variantă.","allowedTools":{"text":true,"drawing":true,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb
 WHERE id = '81818181-8181-8181-8181-818181818181';

UPDATE activity_resources
   SET title = 'Resursă editată', url = 'https://example.test/editata'
 WHERE id = '83838383-8383-8383-8383-838383838383';

SELECT is(
  (SELECT config_data->>'prompt' FROM activities WHERE id = '81818181-8181-8181-8181-818181818181'),
  'Scrie a doua variantă.',
  'owner teacher can edit live config on a private ready activity without changing lifecycle fields'
);

DELETE FROM activities
 WHERE id = '81818181-8181-8181-8181-818181818181';

SELECT is(
  (SELECT count(*) FROM activities WHERE id = '81818181-8181-8181-8181-818181818181'),
  1::bigint,
  'owner teacher cannot directly delete a ready private activity and cascade its versions'
);

RESET ROLE;
RESET "request.jwt.claims";

SELECT is(
  (SELECT config_data->>'prompt' FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181' AND version_number = 1),
  'Scrie prima variantă.',
  'editing live ready config does not mutate the old version snapshot'
);

SELECT is(
  (SELECT url FROM activity_resources WHERE version_id = (SELECT id FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181' AND version_number = 1) AND sort_order = 1),
  'https://example.test/prima',
  'editing live resources does not mutate the old version resource snapshot'
);

SET LOCAL ROLE service_role;
SET LOCAL "request.jwt.claims" = '{"role":"service_role"}';

SELECT public.make_teacher_activity_ready_atomically(
  '81818181-8181-8181-8181-818181818181',
  'free-response',
  '{"prompt":"Scrie a doua variantă.","allowedTools":{"text":true,"drawing":true,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
  1,
  '88888888-8888-8888-8888-888888888888',
  'published',
  TRUE,
  1
);

SELECT is(
  (SELECT max(version_number) FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181'),
  2,
  'ready after unsnapshotted edits creates the next immutable version'
);

SELECT is(
  (SELECT url FROM activity_resources WHERE version_id = (SELECT id FROM activity_versions WHERE activity_id = '81818181-8181-8181-8181-818181818181' AND version_number = 2) AND sort_order = 1),
  'https://example.test/editata',
  'ready after live resource edits snapshots the changed resources onto the next version'
);

PREPARE non_owner_ready_call AS
  SELECT public.make_teacher_activity_ready_atomically(
    '81818181-8181-8181-8181-818181818181',
    'free-response',
    '{"prompt":"Scrie a doua variantă.","allowedTools":{"text":true,"drawing":true,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1,
    '99999999-9999-9999-9999-999999999999',
    'published',
    TRUE,
    1
  );
SELECT throws_ok('non_owner_ready_call', '42501', NULL, 'ready RPC rejects non-owner teachers');

PREPARE invalid_config_ready_call AS
  SELECT public.make_teacher_activity_ready_atomically(
    '82828282-8282-8282-8282-828282828282',
    'free-response',
    '{"prompt":" ","allowedTools":{"text":false,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1,
    '88888888-8888-8888-8888-888888888888',
    'draft',
    FALSE,
    1
  );
SELECT throws_ok('invalid_config_ready_call', '23514', NULL, 'ready RPC rejects config that does not match the activity type schema');

RESET ROLE;
RESET "request.jwt.claims";

SELECT * FROM finish();

ROLLBACK;

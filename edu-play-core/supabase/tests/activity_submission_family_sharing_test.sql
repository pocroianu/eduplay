-- ============================================================================
-- Free-response family sharing semantics.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(10);

SELECT has_table('public', 'activity_submission_family_shares', 'family-share eligibility table exists');
SELECT has_column('public', 'activity_submission_family_shares', 'family_comment', 'family-share table stores optional family-facing comment');
SELECT hasnt_column('public', 'activity_submission_attempts', 'family_comment', 'student-readable attempts do not store family-facing comments');
SELECT ok(
  NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'activity_submission_family_shares'
       AND policyname ILIKE '%student%'
  ),
  'family-share metadata has no student RLS policy'
);

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('41414141-4141-4141-8141-414141414141', 'family-share-teacher@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('42424242-4242-4242-8242-424242424242', 'family-share-student@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
VALUES
  ('41414141-4141-4141-8141-414141414141', 'family-share-teacher@example.com', 'Family Share Teacher', 'teacher'),
  ('42424242-4242-4242-8242-424242424242', 'family-share-student@example.com', 'Family Share Student', 'student')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO classes (id, teacher_id, name)
VALUES ('43434343-4343-4343-8343-434343434343', '41414141-4141-4141-8141-414141414141', 'Family Share Class');

INSERT INTO students (id, class_id, username)
VALUES ('42424242-4242-4242-8242-424242424242', '43434343-4343-4343-8343-434343434343', 'family-share-student');

INSERT INTO activities (id, template, title, status, is_published, visibility_scope, created_by, config_data, config_schema_version)
VALUES
  (
    '44444444-4444-4444-8444-444444444444',
    'free-response',
    'Shared-on-approval activity',
    'published',
    TRUE,
    'private',
    '41414141-4141-4141-8141-414141414141',
    '{"prompt":"Share","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":true}'::jsonb,
    1
  ),
  (
    '45454545-4545-4545-8545-454545454545',
    'free-response',
    'Private-on-approval activity',
    'published',
    TRUE,
    'private',
    '41414141-4141-4141-8141-414141414141',
    '{"prompt":"Private","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1
  );

INSERT INTO activity_versions (id, activity_id, version_number, config_data, config_schema_version, activity_type_id, published_by_user_id)
VALUES
  (
    '46464646-4646-4646-8646-464646464646',
    '44444444-4444-4444-8444-444444444444',
    1,
    '{"prompt":"Share","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":true}'::jsonb,
    1,
    'free-response',
    '41414141-4141-4141-8141-414141414141'
  ),
  (
    '47474747-4747-4747-8747-474747474747',
    '45454545-4545-4545-8545-454545454545',
    1,
    '{"prompt":"Private","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1,
    'free-response',
    '41414141-4141-4141-8141-414141414141'
  );

INSERT INTO assignments (id, teacher_id, class_id, activity_id, version_id)
VALUES
  (
    '48484848-4848-4848-8848-484848484848',
    '41414141-4141-4141-8141-414141414141',
    '43434343-4343-4343-8343-434343434343',
    '44444444-4444-4444-8444-444444444444',
    '46464646-4646-4646-8646-464646464646'
  ),
  (
    '49494949-4949-4949-8949-494949494949',
    '41414141-4141-4141-8141-414141414141',
    '43434343-4343-4343-8343-434343434343',
    '45454545-4545-4545-8545-454545454545',
    '47474747-4747-4747-8747-474747474747'
  );

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"42424242-4242-4242-8242-424242424242"}';

SELECT (public.record_activity_submission(
  '48484848-4848-4848-8848-484848484848',
  '44444444-4444-4444-8444-444444444444',
  '46464646-4646-4646-8646-464646464646',
  'submit',
  '{"text":"work to share"}'::jsonb
)).id;

SELECT (public.record_activity_submission(
  '49494949-4949-4949-8949-494949494949',
  '45454545-4545-4545-8545-454545454545',
  '47474747-4747-4747-8747-474747474747',
  'submit',
  '{"text":"private work"}'::jsonb
)).id;

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"41414141-4141-4141-8141-414141414141"}';

PREPARE approve_shared AS
  SELECT public.review_activity_submission(
    (SELECT id FROM activity_submissions WHERE assignment_id = '48484848-4848-4848-8848-484848484848'),
    'approved',
    NULL,
    '  Great perseverance for family!  '
  );
SELECT lives_ok('approve_shared', 'teacher can approve with an optional family-facing comment');

PREPARE approve_private AS
  SELECT public.review_activity_submission(
    (SELECT id FROM activity_submissions WHERE assignment_id = '49494949-4949-4949-8949-494949494949'),
    'approved',
    NULL,
    'Should not be family visible'
  );
SELECT lives_ok('approve_private', 'approval still works when family sharing is disabled');

RESET ROLE;
RESET "request.jwt.claims";

SELECT is(
  (SELECT count(*) FROM activity_submission_family_shares share JOIN activity_submissions submission ON submission.id = share.submission_id WHERE submission.assignment_id = '48484848-4848-4848-8848-484848484848'),
  1::bigint,
  'approval records family-share eligibility when the assigned version enables family sharing'
);

SELECT is(
  (SELECT share.family_comment FROM activity_submission_family_shares share JOIN activity_submissions submission ON submission.id = share.submission_id WHERE submission.assignment_id = '48484848-4848-4848-8848-484848484848'),
  'Great perseverance for family!',
  'family-facing comment is trimmed and stored separately from student-readable attempts'
);

SELECT is(
  (SELECT attempt.teacher_feedback FROM activity_submission_attempts attempt JOIN activity_submissions submission ON submission.latest_attempt_id = attempt.id WHERE submission.assignment_id = '48484848-4848-4848-8848-484848484848'),
  NULL,
  'approval does not populate student-facing feedback'
);

SELECT is(
  (SELECT count(*) FROM activity_submission_family_shares share JOIN activity_submissions submission ON submission.id = share.submission_id WHERE submission.assignment_id = '49494949-4949-4949-8949-494949494949'),
  0::bigint,
  'approval keeps attempts private when the assigned version disables family sharing'
);

SELECT * FROM finish();

ROLLBACK;

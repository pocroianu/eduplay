-- ============================================================================
-- Free-response submission model and lifecycle transitions.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(24);

SELECT has_table('public', 'activity_submissions', 'activity_submissions table exists');
SELECT has_table('public', 'activity_submission_attempts', 'activity_submission_attempts table exists');

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('31313131-3131-4131-8131-313131313131', 'submission-teacher-a@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('32323232-3232-4232-8232-323232323232', 'submission-teacher-b@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'submission-student-a@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
VALUES
  ('31313131-3131-4131-8131-313131313131', 'submission-teacher-a@example.com', 'Submission Teacher A', 'teacher'),
  ('32323232-3232-4232-8232-323232323232', 'submission-teacher-b@example.com', 'Submission Teacher B', 'teacher'),
  ('33333333-3333-4333-8333-333333333333', 'submission-student-a@example.com', 'Submission Student A', 'student')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO classes (id, teacher_id, name)
VALUES ('34343434-3434-4434-8434-343434343434', '31313131-3131-4131-8131-313131313131', 'Submission Class A');

INSERT INTO students (id, class_id, username)
VALUES ('33333333-3333-4333-8333-333333333333', '34343434-3434-4434-8434-343434343434', 'submission-student-a');

INSERT INTO activities (id, template, title, status, is_published, visibility_scope, created_by, config_data, config_schema_version)
VALUES (
  '35353535-3535-4535-8535-353535353535',
  'free-response',
  'Submission ready activity',
  'published',
  TRUE,
  'private',
  '31313131-3131-4131-8131-313131313131',
  '{"prompt":"Write","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
  1
);

INSERT INTO activity_versions (id, activity_id, version_number, config_data, config_schema_version, activity_type_id, published_by_user_id)
VALUES (
  '36363636-3636-4636-8636-363636363636',
  '35353535-3535-4535-8535-353535353535',
  1,
  '{"prompt":"Write","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
  1,
  'free-response',
  '31313131-3131-4131-8131-313131313131'
);

INSERT INTO assignments (id, teacher_id, class_id, activity_id, version_id)
VALUES (
  '37373737-3737-4737-8737-373737373737',
  '31313131-3131-4131-8131-313131313131',
  '34343434-3434-4434-8434-343434343434',
  '35353535-3535-4535-8535-353535353535',
  '36363636-3636-4636-8636-363636363636'
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"33333333-3333-4333-8333-333333333333"}';

PREPARE start_submission AS
  SELECT (public.record_activity_submission(
    '37373737-3737-4737-8737-373737373737',
    '35353535-3535-4535-8535-353535353535',
    '36363636-3636-4636-8636-363636363636',
    'start',
    '{"text":"draft"}'::jsonb
  )).id;
SELECT lives_ok('start_submission', 'student lazily creates a draft submission when starting assigned work');

SELECT is(
  (SELECT count(*) FROM activity_submission_attempts WHERE response = '{"text":"draft"}'::jsonb AND status = 'draft'),
  1::bigint,
  'lazy start creates one draft attempt'
);

PREPARE submit_empty_attempt AS
  SELECT (public.record_activity_submission(
    '37373737-3737-4737-8737-373737373737',
    '35353535-3535-4535-8535-353535353535',
    '36363636-3636-4636-8636-363636363636',
    'submit',
    '{"text":"   "}'::jsonb
  )).status;
SELECT throws_ok('submit_empty_attempt', '23514', NULL, 'submitted response requires at least one response part');

PREPARE submit_null_drawing_attempt AS
  SELECT (public.record_activity_submission(
    '37373737-3737-4737-8737-373737373737',
    '35353535-3535-4535-8535-353535353535',
    '36363636-3636-4636-8636-363636363636',
    'submit',
    '{"drawing":null}'::jsonb
  )).status;
SELECT throws_ok('submit_null_drawing_attempt', '23514', NULL, 'null drawing does not count as a response');

PREPARE submit_empty_voice_attempt AS
  SELECT (public.record_activity_submission(
    '37373737-3737-4737-8737-373737373737',
    '35353535-3535-4535-8535-353535353535',
    '36363636-3636-4636-8636-363636363636',
    'submit',
    '{"voice":{}}'::jsonb
  )).status;
SELECT throws_ok('submit_empty_voice_attempt', '23514', NULL, 'empty voice object does not count as a response');

PREPARE submit_first_attempt AS
  SELECT (public.record_activity_submission(
    '37373737-3737-4737-8737-373737373737',
    '35353535-3535-4535-8535-353535353535',
    '36363636-3636-4636-8636-363636363636',
    'submit',
    '{"text":"submitted once"}'::jsonb
  )).status;
SELECT lives_ok('submit_first_attempt', 'student can submit the draft attempt');

SELECT is(
  (SELECT latest_attempt_number FROM activity_submissions WHERE assignment_id = '37373737-3737-4737-8737-373737373737'),
  1,
  'current submission stores latest submitted attempt number'
);

RESET ROLE;
RESET "request.jwt.claims";

PREPARE mutate_submitted_attempt AS
  UPDATE activity_submission_attempts
     SET response = '{"text":"tampered"}'::jsonb
   WHERE submission_id = (
     SELECT id FROM activity_submissions WHERE assignment_id = '37373737-3737-4737-8737-373737373737'
   )
     AND attempt_number = 1;
SELECT throws_ok('mutate_submitted_attempt', '23514', NULL, 'submitted attempts are immutable');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"33333333-3333-4333-8333-333333333333"}';

PREPARE student_approves_own_submission AS
  UPDATE activity_submissions
     SET status = 'approved'
   WHERE assignment_id = '37373737-3737-4737-8737-373737373737';
SELECT lives_ok('student_approves_own_submission', 'student approval attempt does not error');
SELECT is(
  (SELECT status FROM activity_submissions WHERE assignment_id = '37373737-3737-4737-8737-373737373737'),
  'submitted',
  'student cannot approve their own submission'
);

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"32323232-3232-4232-8232-323232323232"}';

PREPARE other_teacher_review AS
  SELECT public.review_activity_submission(
    (SELECT id FROM activity_submissions WHERE assignment_id = '37373737-3737-4737-8737-373737373737'),
    'approved',
    NULL
  );
SELECT throws_ok('other_teacher_review', '42501', NULL, 'non-owning teacher cannot review another teacher submission');

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"31313131-3131-4131-8131-313131313131"}';

PREPARE request_revision AS
  SELECT (public.review_activity_submission(
    (SELECT id FROM activity_submissions WHERE assignment_id = '37373737-3737-4737-8737-373737373737'),
    'needs_revision',
    'Mai încearcă o dată.'
  )).status;
SELECT lives_ok('request_revision', 'owning teacher can request revision on a submitted attempt');

SELECT is(
  (SELECT status FROM activity_submissions WHERE assignment_id = '37373737-3737-4737-8737-373737373737'),
  'needs_revision',
  'request revision updates submission aggregate status'
);

SELECT is(
  (SELECT review_status FROM activity_submission_attempts WHERE attempt_number = 1),
  'needs_revision',
  'request revision updates the latest attempt review status'
);

SELECT is(
  (SELECT teacher_feedback FROM activity_submission_attempts WHERE attempt_number = 1),
  'Mai încearcă o dată.',
  'request revision stores student-facing feedback on the attempt'
);

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"33333333-3333-4333-8333-333333333333"}';

PREPARE start_revision AS
  SELECT (public.record_activity_submission(
    '37373737-3737-4737-8737-373737373737',
    '35353535-3535-4535-8535-353535353535',
    '36363636-3636-4636-8636-363636363636',
    'start',
    '{}'::jsonb
  )).status;
SELECT lives_ok('start_revision', 'student can reopen a revision as an editable draft');

SELECT is(
  (SELECT response FROM activity_submission_attempts WHERE attempt_number = 2),
  '{"text":"submitted once"}'::jsonb,
  'revision draft starts from the latest submitted response'
);

PREPARE submit_revision AS
  SELECT (public.record_activity_submission(
    '37373737-3737-4737-8737-373737373737',
    '35353535-3535-4535-8535-353535353535',
    '36363636-3636-4636-8636-363636363636',
    'submit',
    '{"text":"revision submitted"}'::jsonb
  )).status;
SELECT lives_ok('submit_revision', 'needs revision can transition back to submitted with latest aggregate state');

SELECT is(
  (SELECT latest_attempt_number FROM activity_submissions WHERE assignment_id = '37373737-3737-4737-8737-373737373737'),
  2,
  'attempt history is preserved across revisions'
);

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"31313131-3131-4131-8131-313131313131"}';

PREPARE approve_revision AS
  UPDATE activity_submissions
     SET status = 'approved'
   WHERE assignment_id = '37373737-3737-4737-8737-373737373737';
SELECT lives_ok('approve_revision', 'owning teacher direct approval keeps review state consistent');

SELECT is(
  (SELECT status FROM activity_submissions WHERE assignment_id = '37373737-3737-4737-8737-373737373737'),
  'approved',
  'approval updates submission aggregate status'
);

SELECT is(
  (SELECT review_status FROM activity_submission_attempts WHERE attempt_number = 2),
  'approved',
  'approval updates the latest attempt review status'
);

RESET ROLE;
RESET "request.jwt.claims";

SELECT * FROM finish();

ROLLBACK;

-- ============================================================================
-- Assignment Activity/version integrity for private ready Activities.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(7);

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('21212121-2121-2121-2121-212121212121', 'assign-teacher-a@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'assign-teacher-b@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('29292929-2929-2929-2929-292929292929', 'assign-student-a@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
VALUES
  ('21212121-2121-2121-2121-212121212121', 'assign-teacher-a@example.com', 'Assign Teacher A', 'teacher'),
  ('22222222-2222-2222-2222-222222222222', 'assign-teacher-b@example.com', 'Assign Teacher B', 'teacher'),
  ('29292929-2929-2929-2929-292929292929', 'assign-student-a@example.com', 'Assign Student A', 'student')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO classes (id, teacher_id, name)
VALUES
  ('23232323-2323-2323-2323-232323232323', '21212121-2121-2121-2121-212121212121', 'Class A'),
  ('24242424-2424-2424-2424-242424242424', '22222222-2222-2222-2222-222222222222', 'Class B');

INSERT INTO students (id, class_id, username)
VALUES
  ('29292929-2929-2929-2929-292929292929', '23232323-2323-2323-2323-232323232323', 'assign-student-a');

INSERT INTO activities (id, template, title, status, is_published, visibility_scope, created_by, config_data, config_schema_version)
VALUES
  (
    '25252525-2525-2525-2525-252525252525',
    'free-response',
    'Teacher A private ready',
    'published',
    TRUE,
    'private',
    '21212121-2121-2121-2121-212121212121',
    '{"prompt":"A","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1
  ),
  (
    '26262626-2626-2626-2626-262626262626',
    'free-response',
    'Teacher B private ready',
    'published',
    TRUE,
    'private',
    '22222222-2222-2222-2222-222222222222',
    '{"prompt":"B","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    1
  );

INSERT INTO activity_versions (id, activity_id, version_number, config_data, config_schema_version, activity_type_id, published_by_user_id)
VALUES
  ('27272727-2727-2727-2727-272727272727', '25252525-2525-2525-2525-252525252525', 1, '{"prompt":"A","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb, 1, 'free-response', '21212121-2121-2121-2121-212121212121'),
  ('28282828-2828-2828-2828-282828282828', '26262626-2626-2626-2626-262626262626', 1, '{"prompt":"B","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb, 1, 'free-response', '22222222-2222-2222-2222-222222222222');

PREPARE forged_private_assignment AS
  INSERT INTO assignments (teacher_id, class_id, activity_id, version_id)
  VALUES (
    '22222222-2222-2222-2222-222222222222',
    '24242424-2424-2424-2424-242424242424',
    '25252525-2525-2525-2525-252525252525',
    '27272727-2727-2727-2727-272727272727'
  );
SELECT throws_ok('forged_private_assignment', '42501', NULL, 'teacher cannot assign another teacher private ready activity');

INSERT INTO assignments (teacher_id, class_id, activity_id, version_id)
VALUES (
  '21212121-2121-2121-2121-212121212121',
  '23232323-2323-2323-2323-232323232323',
  '25252525-2525-2525-2525-252525252525',
  '27272727-2727-2727-2727-272727272727'
);
SELECT is(
  (SELECT count(*) FROM assignments WHERE activity_id = '25252525-2525-2525-2525-252525252525'),
  1::bigint,
  'teacher can assign own private ready activity with matching version pin'
);

PREPARE mismatched_version_assignment AS
  INSERT INTO assignments (teacher_id, class_id, activity_id, version_id)
  VALUES (
    '21212121-2121-2121-2121-212121212121',
    '23232323-2323-2323-2323-232323232323',
    '25252525-2525-2525-2525-252525252525',
    '28282828-2828-2828-2828-282828282828'
  );
SELECT throws_ok('mismatched_version_assignment', '23514', NULL, 'assignment version pin must belong to the assigned activity');

PREPARE ambiguous_class_and_student_assignment AS
  INSERT INTO assignments (teacher_id, class_id, student_id, activity_id, version_id)
  VALUES (
    '21212121-2121-2121-2121-212121212121',
    '23232323-2323-2323-2323-232323232323',
    '29292929-2929-2929-2929-292929292929',
    '25252525-2525-2525-2525-252525252525',
    '27272727-2727-2727-2727-272727272727'
  );
SELECT throws_ok('ambiguous_class_and_student_assignment', '23514', NULL, 'assignment must target exactly one class or student');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}';

PREPARE cross_roster_class_assignment AS
  INSERT INTO assignments (teacher_id, class_id, activity_id, version_id)
  VALUES (
    '22222222-2222-2222-2222-222222222222',
    '23232323-2323-2323-2323-232323232323',
    '26262626-2626-2626-2626-262626262626',
    '28282828-2828-2828-2828-282828282828'
  );
SELECT throws_ok('cross_roster_class_assignment', '42501', NULL, 'RLS blocks assigning a class outside the teacher roster');

PREPARE cross_roster_student_assignment AS
  INSERT INTO assignments (teacher_id, student_id, activity_id, version_id)
  VALUES (
    '22222222-2222-2222-2222-222222222222',
    '29292929-2929-2929-2929-292929292929',
    '26262626-2626-2626-2626-262626262626',
    '28282828-2828-2828-2828-282828282828'
  );
SELECT throws_ok('cross_roster_student_assignment', '42501', NULL, 'RLS blocks assigning a student outside the teacher roster');

RESET ROLE;
RESET "request.jwt.claims";

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"21212121-2121-2121-2121-212121212121"}';

PREPARE own_roster_student_assignment AS
  INSERT INTO assignments (teacher_id, student_id, activity_id, version_id)
  VALUES (
    '21212121-2121-2121-2121-212121212121',
    '29292929-2929-2929-2929-292929292929',
    '25252525-2525-2525-2525-252525252525',
    '27272727-2727-2727-2727-272727272727'
  );
SELECT lives_ok('own_roster_student_assignment', 'RLS allows assigning a student in the teacher roster');

RESET ROLE;
RESET "request.jwt.claims";

SELECT * FROM finish();

ROLLBACK;

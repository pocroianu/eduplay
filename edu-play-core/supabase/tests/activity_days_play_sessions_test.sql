BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

INSERT INTO auth.users(id, email, instance_id, aud, role) VALUES
 ('81313131-3131-4131-8131-313131313131', 'session-teacher@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
 ('82323232-3232-4232-8232-323232323232', 'session-student@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
 ('83333333-3333-4333-8333-333333333333', 'session-other@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
 ('84343434-3434-4434-8434-343434343434', 'session-parent@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
INSERT INTO profiles(id, email, full_name, role) VALUES
 ('81313131-3131-4131-8131-313131313131', 'session-teacher@example.com', 'Teacher', 'teacher'),
 ('82323232-3232-4232-8232-323232323232', 'session-student@example.com', 'Learner', 'student'),
 ('83333333-3333-4333-8333-333333333333', 'session-other@example.com', 'Other learner', 'student'),
 ('84343434-3434-4434-8434-343434343434', 'session-parent@example.com', 'Parent', 'parent')
 ON CONFLICT(id) DO UPDATE SET role = EXCLUDED.role;
INSERT INTO classes(id, teacher_id, name) VALUES
 ('85353535-3535-4535-8535-353535353535', '81313131-3131-4131-8131-313131313131', 'Session class');
INSERT INTO students(id, class_id, username) VALUES
 ('82323232-3232-4232-8232-323232323232', '85353535-3535-4535-8535-353535353535', 'session-learner'),
 ('83333333-3333-4333-8333-333333333333', NULL, 'session-other');
INSERT INTO parent_children(parent_id, student_id, status) VALUES
 ('84343434-3434-4434-8434-343434343434', '82323232-3232-4232-8232-323232323232', 'active');
INSERT INTO activities(id, template, title, status, is_published, visibility_scope, created_by, config_data, config_schema_version)
 VALUES ('86363636-3636-4636-8636-363636363636', 'free-response', 'Session Activity', 'published', true, 'private',
 '81313131-3131-4131-8131-313131313131', '{"prompt":"Write","allowedTools":{"text":true,"drawing":false,"voice":false}}', 1);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"82323232-3232-4232-8232-323232323232"}';
PREPARE first_save AS SELECT (public.record_activity_play_session(
 '82323232-3232-4232-8232-323232323232', '86363636-3636-4636-8636-363636363636',
 '87373737-3737-4737-8737-373737373737', 1, 5, 'in_progress')).time_spent;
SELECT lives_ok('first_save', 'learner can save a play session');
SELECT is((SELECT time_spent FROM activity_progress WHERE student_id = auth.uid()), 5, 'first cumulative snapshot adds five seconds');
SELECT lives_ok('first_save', 'lost-response retry succeeds');
SELECT is((SELECT time_spent FROM activity_progress WHERE student_id = auth.uid()), 5, 'retry does not add time twice');
SELECT is((SELECT count(*) FROM activity_days), 1::bigint, 'saved engagement records one learner day');
SELECT is((SELECT active_day FROM activity_days), (statement_timestamp() AT TIME ZONE 'Europe/Bucharest')::date, 'day uses Bucharest calendar');

SELECT public.record_activity_play_session('82323232-3232-4232-8232-323232323232', '86363636-3636-4636-8636-363636363636',
 '87373737-3737-4737-8737-373737373737', 3, 12, 'completed', p_score => 80);
SELECT public.record_activity_play_session('82323232-3232-4232-8232-323232323232', '86363636-3636-4636-8636-363636363636',
 '87373737-3737-4737-8737-373737373737', 2, 8, 'in_progress', p_score => 10);
SELECT public.record_activity_play_session('82323232-3232-4232-8232-323232323232', '86363636-3636-4636-8636-363636363636',
 '87373737-3737-4737-8737-373737373737', 4, 20, 'in_progress', p_score => 10);
SELECT is((SELECT time_spent FROM activity_progress WHERE student_id = auth.uid()), 12, 'completion freezes time despite stale or late progress');
SELECT is((SELECT status FROM activity_progress WHERE student_id = auth.uid()), 'completed', 'completion stays terminal');
SELECT is((SELECT attempts FROM activity_progress WHERE student_id = auth.uid()), 1, 'updates are not counted as new play sessions');
SELECT public.record_activity_play_session('82323232-3232-4232-8232-323232323232', '86363636-3636-4636-8636-363636363636',
 '88383838-3838-4838-8838-383838383838', 1, 3, 'in_progress', p_score => 10);
SELECT is((SELECT time_spent FROM activity_progress WHERE student_id = auth.uid()), 15, 'restart adds only the new session time');
SELECT is((SELECT score FROM activity_progress WHERE student_id = auth.uid()), 80, 'new in-progress writes preserve completed score');

SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"83333333-3333-4333-8333-333333333333"}';
SELECT is((SELECT count(*) FROM activity_days), 0::bigint, 'unrelated learner cannot read days');
SELECT throws_ok($$SELECT public.record_activity_play_session('82323232-3232-4232-8232-323232323232', '86363636-3636-4636-8636-363636363636',
 '89393939-3939-4939-8939-393939393939', 1, 1, 'completed')$$, '42501', NULL, 'learner cannot write another learner progress');
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"81313131-3131-4131-8131-313131313131"}';
SELECT is((SELECT count(*) FROM activity_days), 1::bigint, 'class teacher can read learner days');
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"84343434-3434-4434-8434-343434343434"}';
SELECT is((SELECT count(*) FROM activity_days), 1::bigint, 'linked parent can read learner days');
SELECT throws_ok($$INSERT INTO activity_days VALUES ('82323232-3232-4232-8232-323232323232', '2000-01-01')$$,
 '42501', NULL, 'clients cannot forge activity days');
SELECT * FROM finish();
ROLLBACK;

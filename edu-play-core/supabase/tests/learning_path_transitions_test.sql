BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(26);

INSERT INTO auth.users(id,email,instance_id,aud,role) VALUES
 ('c1000000-0000-4000-8000-000000000001','path-teacher@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('c1000000-0000-4000-8000-000000000002','path-foreign@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('c1000000-0000-4000-8000-000000000003','path-student@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('c1000000-0000-4000-8000-000000000004','path-admin@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
INSERT INTO profiles(id,email,full_name,role) VALUES
 ('c1000000-0000-4000-8000-000000000001','path-teacher@test.invalid','Teacher','teacher'),
 ('c1000000-0000-4000-8000-000000000002','path-foreign@test.invalid','Foreign','teacher'),
 ('c1000000-0000-4000-8000-000000000003','path-student@test.invalid','Student','student'),
 ('c1000000-0000-4000-8000-000000000004','path-admin@test.invalid','Admin','admin')
 ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role;
INSERT INTO classes(id,teacher_id,name) VALUES
 ('c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Path class');
INSERT INTO students(id,class_id,username) VALUES
 ('c1000000-0000-4000-8000-000000000003','c2000000-0000-4000-8000-000000000001','path-transition-test');
INSERT INTO learning_paths(id,title,created_by,status) VALUES
 ('c3000000-0000-4000-8000-000000000001','Assigned path','c1000000-0000-4000-8000-000000000001','published'),
 ('c3000000-0000-4000-8000-000000000002','Unassigned path','c1000000-0000-4000-8000-000000000001','published');
INSERT INTO learning_path_steps(id,path_id,step_order,kind,target_activity_type,title) VALUES
 ('c4000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',1,'activity_template','free-response','First'),
 ('c4000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001',2,'activity_template','free-response','Second'),
 ('c4000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000002',1,'activity_template','free-response','Foreign');
INSERT INTO learning_path_assignments(path_id,class_id,assigned_by) VALUES
 ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"c1000000-0000-4000-8000-000000000003"}';
SELECT throws_ok($$SELECT advance_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001')$$,'42501',NULL,'students cannot invoke trusted advancement');
SELECT throws_ok($$SELECT override_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','completed')$$,'42501',NULL,'students cannot invoke teacher override');
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"c1000000-0000-4000-8000-000000000002"}';
SELECT throws_ok($$SELECT override_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','completed')$$,'42501',NULL,'foreign teacher cannot override');

SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT advance_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-000000000003')$$,'42501',NULL,'unassigned path cannot advance');
SELECT throws_ok($$SELECT advance_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000003')$$,'23514',NULL,'step must belong to path');
SELECT lives_ok($$SELECT advance_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002')$$,'locked later step is ignored');
SELECT is((SELECT count(*) FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),0::bigint,'ignored step creates no progress row');
SELECT lives_ok($$SELECT advance_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001')$$,'first completion initializes progress');
SELECT is((SELECT current_step_id FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'c4000000-0000-4000-8000-000000000002'::uuid,'cursor moves to second step');
SELECT ok((SELECT started_at IS NOT NULL AND completed_at IS NULL FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'initial progress has start time only');
UPDATE student_path_progress SET started_at='2026-01-01' WHERE student_id='c1000000-0000-4000-8000-000000000003';
-- Observe a duplicate through the real transition rather than reimplementing guards.
SELECT advance_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001');
SELECT is((SELECT last_completed_step_id FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'c4000000-0000-4000-8000-000000000001'::uuid,'duplicate does not move cursor or last completed');
SELECT lives_ok($$SELECT advance_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000002')$$,'last step completes path');
SELECT ok((SELECT status='completed' AND current_step_id IS NULL AND completed_at IS NOT NULL AND started_at='2026-01-01'::timestamptz FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'completion preserves start time and sets final state');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"c1000000-0000-4000-8000-000000000001"}';
SELECT lives_ok($$SELECT override_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','in_progress','c4000000-0000-4000-8000-000000000002')$$,'teacher can deliberately reopen');
SELECT ok((SELECT status='in_progress' AND completed_at IS NULL AND last_completed_step_id IS NULL FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'reopening clears stale completion state');
SELECT throws_ok($$SELECT override_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000002','completed')$$,'42501',NULL,'teacher cannot override an unassigned path');
SELECT throws_ok($$SELECT override_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','in_progress','c4000000-0000-4000-8000-000000000003')$$,'23503',NULL,'override rejects a step from another path');
SELECT throws_ok($$SELECT override_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','invalid')$$,'23514',NULL,'override validates status');
SELECT lives_ok($$SELECT override_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','overridden')$$,'teacher can stop automatic advancement');
SET LOCAL ROLE service_role;
SELECT advance_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001');
SELECT is((SELECT status FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'overridden','completion cannot overwrite an override');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"c1000000-0000-4000-8000-000000000004"}';
SELECT lives_ok($$SELECT override_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','completed')$$,'admin override works despite scoped student RLS');
RESET ROLE;
SELECT ok((SELECT status='completed' AND completed_at IS NOT NULL FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'admin completion is persisted');
SELECT ok(NOT has_function_privilege('anon','public.override_learning_path_progress(uuid,uuid,text,uuid)','EXECUTE'),'anonymous cannot override');
SELECT ok(NOT has_function_privilege('authenticated','public.advance_learning_path_progress(uuid,uuid,uuid)','EXECUTE'),'advancement is trusted-server only');
SELECT is((SELECT count(*) FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),1::bigint,'transitions keep one progress row');
SET LOCAL ROLE service_role;
SELECT advance_learning_path_progress('c1000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001');
SELECT is((SELECT status FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'completed','automatic completion cannot reopen a completed override');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT no_plan();

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
 ('c4000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000001',1,'activity_template','drawing-canvas','First'),
 ('c4000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000001',2,'activity_template','drawing-canvas','Second'),
 ('c4000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000002',1,'activity_template','drawing-canvas','Foreign');
INSERT INTO learning_path_assignments(path_id,class_id,assigned_by) VALUES
 ('c3000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001');


UPDATE learning_path_steps SET target_activity_config='{}';
INSERT INTO activity_instances(id,type_id,config,assigned_to,created_by) VALUES
('d1000000-0000-4000-8000-000000000001','drawing-canvas','{}','c1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims"='{"role":"authenticated","sub":"c1000000-0000-4000-8000-000000000003"}';
SELECT throws_ok($$SELECT accept_native_activity_submission('c1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','drawing-canvas','c1000000-0000-4000-8000-000000000003/d3000000-0000-4000-8000-000000000001.png')$$,'42501',NULL,'learner cannot forge a trusted completion');
SET LOCAL ROLE service_role;
SET LOCAL "request.jwt.claims"='{}';
SELECT throws_ok($$SELECT accept_native_activity_submission('c1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','drawing-canvas','c1000000-0000-4000-8000-000000000002/d3000000-0000-4000-8000-000000000001.png')$$,'42501',NULL,'foreign learner cannot save instance');
SELECT accept_native_activity_submission('c1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','drawing-canvas','c1000000-0000-4000-8000-000000000003/d3000000-0000-4000-8000-000000000001.png');
SELECT is((SELECT count(*) FROM native_activity_submission_targets),1::bigint,'freeze only the first eligible step despite identical later config');
SELECT is((SELECT result_summary->>'status' FROM activity_instances WHERE id='d1000000-0000-4000-8000-000000000001'),'completed','instance completion commits with artifact and receipt');
SELECT is((SELECT actor_id FROM audit_log WHERE artifact_id=(SELECT artifact_id FROM native_activity_submissions WHERE id='d2000000-0000-4000-8000-000000000001') ORDER BY created_at LIMIT 1),'c1000000-0000-4000-8000-000000000003'::uuid,'privileged writes preserve verified learner audit attribution');
SELECT accept_native_activity_submission('c1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','drawing-canvas','c1000000-0000-4000-8000-000000000003/d3000000-0000-4000-8000-000000000002.png');
SELECT is((SELECT count(*) FROM child_artifacts),1::bigint,'lost-response replay reuses artifact');
RESET ROLE;
CREATE FUNCTION pg_temp.reject_progress() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test unavailable'; END $$;
CREATE TRIGGER test_reject_progress BEFORE INSERT OR UPDATE ON student_path_progress FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_progress();
SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT retry_native_activity_progress('c1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001')$$,'P0001','test unavailable','progression may fail after work is saved');
SELECT is((SELECT count(*) FROM native_activity_submission_targets WHERE settled),0::bigint,'failed progression leaves durable pending target');
SELECT is((SELECT count(*) FROM child_artifacts),1::bigint,'progression failure retains saved artifact');
RESET ROLE;
DROP TRIGGER test_reject_progress ON student_path_progress;
SET LOCAL ROLE service_role;
SELECT retry_native_activity_progress('c1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001');
SELECT is((SELECT current_step_id FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'c4000000-0000-4000-8000-000000000002'::uuid,'retry advances only original eligible step');
SELECT retry_native_activity_progress('c1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001');
SELECT is((SELECT status FROM student_path_progress WHERE student_id='c1000000-0000-4000-8000-000000000003'),'in_progress','settled retry cannot advance identical next step');
RESET ROLE;
-- Newly assigned paths cannot join an existing receipt.
INSERT INTO learning_path_assignments(path_id,student_id,assigned_by) VALUES
('c3000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001');
UPDATE student_path_progress SET current_step_id='c4000000-0000-4000-8000-000000000001',last_completed_step_id=NULL;
SET LOCAL ROLE service_role;
SELECT retry_native_activity_progress('c1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001');
SELECT is((SELECT current_step_id FROM student_path_progress WHERE path_id='c3000000-0000-4000-8000-000000000001'),'c4000000-0000-4000-8000-000000000001'::uuid,'settled receipt respects teacher reopening');
SELECT is((SELECT count(*) FROM student_path_progress),1::bigint,'new path is not retrospectively advanced');
SELECT accept_native_activity_submission('c1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','drawing-canvas','c1000000-0000-4000-8000-000000000003/d3000000-0000-4000-8000-000000000003.png');
SELECT is((SELECT count(*) FROM child_artifacts),2::bigint,'Draw again creates another artifact for same instance');
SELECT throws_ok($$SELECT accept_native_activity_submission('c1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000003','drawing-canvas','foreign/object.png')$$,'23514',NULL,'storage paths remain learner-scoped');
RESET ROLE;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims"='{"role":"authenticated","sub":"c1000000-0000-4000-8000-000000000003"}';
SELECT is((SELECT count(*) FROM native_activity_submissions),2::bigint,'owner can recover receipts after reload');
SELECT throws_ok($$UPDATE native_activity_submission_targets SET settled=true$$,'42501',NULL,'learner cannot forge target settlement');
SET LOCAL "request.jwt.claims"='{"role":"authenticated","sub":"c1000000-0000-4000-8000-000000000002"}';
SELECT is((SELECT count(*) FROM native_activity_submissions),0::bigint,'foreign caller cannot recover receipts');
RESET ROLE;
INSERT INTO activity_instances(id,type_id,config,assigned_to,created_by) VALUES
('d1000000-0000-4000-8000-000000000002','voice-recording','{}','c1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001');
SET LOCAL ROLE service_role;
SELECT throws_ok($$SELECT accept_native_activity_submission('c1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000004','voice-recording','c1000000-0000-4000-8000-000000000003/d3000000-0000-4000-8000-000000000004.webm',4200)$$,'42501',NULL,'audio consent is authoritative at commit');
RESET ROLE;
SET LOCAL "request.jwt.claims"='{}';
UPDATE students SET consents=jsonb_build_object('audio_recording',true) WHERE id='c1000000-0000-4000-8000-000000000003';
SET LOCAL ROLE service_role;
SELECT lives_ok($$SELECT accept_native_activity_submission('c1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000004','voice-recording','c1000000-0000-4000-8000-000000000003/d3000000-0000-4000-8000-000000000004.webm',4200)$$,'voice submission uses the shared durable workflow');
SELECT is((SELECT result_summary->>'durationMs' FROM activity_instances WHERE id='d1000000-0000-4000-8000-000000000002'),'4200','voice duration survives completion');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;

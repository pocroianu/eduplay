BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(23);
INSERT INTO auth.users(id,email,instance_id,aud,role) VALUES
 ('d1000000-0000-4000-8000-000000000001','definition-teacher@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('d1000000-0000-4000-8000-000000000002','definition-other@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('d1000000-0000-4000-8000-000000000003','definition-student@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
INSERT INTO profiles(id,email,full_name,role) VALUES
 ('d1000000-0000-4000-8000-000000000001','definition-teacher@test.invalid','Teacher','teacher'),
 ('d1000000-0000-4000-8000-000000000002','definition-other@test.invalid','Other','teacher'),
 ('d1000000-0000-4000-8000-000000000003','definition-student@test.invalid','Student','student')
 ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role;
INSERT INTO classes(id,teacher_id,name) VALUES ('d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','Definition class');
INSERT INTO students(id,class_id,username) VALUES ('d1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','definition-student');
INSERT INTO learning_paths(id,title,created_by) VALUES
 ('d3000000-0000-4000-8000-000000000001','Definition','d1000000-0000-4000-8000-000000000001'),
 ('d3000000-0000-4000-8000-000000000002','Empty','d1000000-0000-4000-8000-000000000001');
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"d1000000-0000-4000-8000-000000000001"}';
INSERT INTO child_artifacts(id,student_id,class_id,artifact_type,storage_path) VALUES
 ('d4000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000001','photo','definition/photo.png');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO learning_paths(title,created_by,status) VALUES ('Direct empty','d1000000-0000-4000-8000-000000000001','published')$$,'23514',NULL,'direct insertion cannot publish an empty path');
SELECT throws_ok($$SELECT append_learning_path_step('d3000000-0000-4000-8000-000000000001','Missing','does-not-exist')$$,'22023',NULL,'append validates Activity type');
SELECT is((SELECT step_order FROM append_learning_path_step('d3000000-0000-4000-8000-000000000001','First','free-response')),0,'first append assigns zero');
SELECT is((SELECT step_order FROM append_learning_path_step('d3000000-0000-4000-8000-000000000001','Second','free-response')),1,'second append assigns next order');
SELECT throws_ok($$SELECT publish_learning_path('d3000000-0000-4000-8000-000000000002')$$,'23514',NULL,'empty path cannot publish');
SELECT is((SELECT status FROM publish_learning_path('d3000000-0000-4000-8000-000000000001')),'published','publish returns committed definition');
SELECT throws_ok($$SELECT append_learning_path_step('d3000000-0000-4000-8000-000000000001','Late','free-response')$$,'P0001','learning_path_not_draft','published path rejects append');
SELECT throws_ok($$UPDATE learning_path_steps SET title='Changed' WHERE path_id='d3000000-0000-4000-8000-000000000001'$$,'P0001','learning_path_not_draft','direct edits cannot mutate published steps');
SELECT throws_ok($$DELETE FROM learning_path_steps WHERE path_id='d3000000-0000-4000-8000-000000000001'$$,'P0001','learning_path_not_draft','direct deletion cannot mutate published steps');
SELECT throws_ok($$INSERT INTO learning_path_steps(path_id,step_order,kind,target_activity_type,title) VALUES ('d3000000-0000-4000-8000-000000000001',2,'activity_template','free-response','Late')$$,'P0001','learning_path_not_draft','direct insert cannot bypass publication');
SELECT throws_ok($$UPDATE learning_paths SET status='draft' WHERE id='d3000000-0000-4000-8000-000000000001'$$,'P0001','learning_path_not_draft','published definitions cannot be reopened');
SELECT ok((SELECT became_family_visible FROM change_artifact_visibility('d4000000-0000-4000-8000-000000000001','family_visible')),'publication authorizes notification');
SELECT ok(NOT (SELECT became_family_visible FROM change_artifact_visibility('d4000000-0000-4000-8000-000000000001','family_visible')),'same-state retry does not authorize notification');
SELECT is((SELECT artifact->>'reviewed_by' FROM change_artifact_visibility('d4000000-0000-4000-8000-000000000001','family_visible')),'d1000000-0000-4000-8000-000000000001','retry retains reviewer');
SELECT ok(NOT (SELECT became_family_visible FROM change_artifact_visibility('d4000000-0000-4000-8000-000000000001','archived')),'archive does not notify');
SELECT ok((SELECT became_family_visible FROM change_artifact_visibility('d4000000-0000-4000-8000-000000000001','family_visible')),'genuine republication authorizes notification');
SELECT throws_ok($$SELECT change_artifact_visibility('d4000000-0000-4000-8000-000000000001','invalid')$$,'23514',NULL,'visibility is validated');
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"d1000000-0000-4000-8000-000000000002"}';
SELECT throws_ok($$SELECT append_learning_path_step('d3000000-0000-4000-8000-000000000002','Foreign','free-response')$$,'P0002',NULL,'foreign teacher cannot append');
SELECT is((SELECT count(*) FROM change_artifact_visibility('d4000000-0000-4000-8000-000000000001','archived')),0::bigint,'foreign teacher cannot transition artifact');
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"d1000000-0000-4000-8000-000000000003"}';
SELECT throws_ok($$SELECT change_artifact_visibility('d4000000-0000-4000-8000-000000000001','family_visible')$$,'42501',NULL,'student cannot publish');
RESET ROLE;
SELECT ok(NOT has_function_privilege('anon','append_learning_path_step(uuid,text,text,jsonb,text)','EXECUTE'),'anonymous cannot append');
SELECT ok(NOT has_function_privilege('anon','publish_learning_path(uuid)','EXECUTE'),'anonymous cannot publish path');
SELECT ok(NOT has_function_privilege('anon','change_artifact_visibility(uuid,text)','EXECUTE'),'anonymous cannot publish artifact');
SELECT * FROM finish();
ROLLBACK;

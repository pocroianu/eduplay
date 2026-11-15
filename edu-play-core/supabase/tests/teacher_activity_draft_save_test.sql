BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(17);

INSERT INTO auth.users(id,email,instance_id,aud,role) VALUES
 ('a8888888-8888-4888-8888-888888888888','atomic-draft-a@example.com','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('a9999999-9999-4999-8999-999999999999','atomic-draft-b@example.com','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
INSERT INTO public.profiles(id,email,full_name,role) VALUES
 ('a8888888-8888-4888-8888-888888888888','atomic-draft-a@example.com','Teacher A','teacher'),
 ('a9999999-9999-4999-8999-999999999999','atomic-draft-b@example.com','Teacher B','teacher')
 ON CONFLICT(id) DO UPDATE SET role = EXCLUDED.role;
CREATE FUNCTION public.fail_test_resource() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.url = 'https://fail.example' THEN RAISE EXCEPTION 'Injected resource failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER fail_test_resource BEFORE INSERT ON public.activity_resources
FOR EACH ROW EXECUTE FUNCTION public.fail_test_resource();

SELECT set_config('test.draft_input', '{"title":"Atomic draft","prompt":"Write","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false,"resources":[{"title":"Original","url":"https://example.test"}]}', true);
SELECT has_function('public','save_teacher_activity_draft',ARRAY['jsonb','uuid'],'atomic draft operation exists');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"a8888888-8888-4888-8888-888888888888"}';
SELECT lives_ok($$SELECT set_config('test.draft_id', public.save_teacher_activity_draft(current_setting('test.draft_input')::jsonb)::text, true)$$,'teacher creates draft atomically');
SELECT is((SELECT config_data->>'prompt' FROM activities WHERE id=current_setting('test.draft_id')::uuid),'Write','config persisted');
SELECT is((SELECT count(*) FROM activity_resources WHERE activity_id=current_setting('test.draft_id')::uuid),1::bigint,'live resources persisted');
SELECT is((SELECT title FROM activity_resources WHERE activity_id=current_setting('test.draft_id')::uuid),'Original','resource order and content persist');
SELECT lives_ok($$SELECT save_teacher_activity_draft(jsonb_set(current_setting('test.draft_input')::jsonb,'{title}','"Updated"'),current_setting('test.draft_id')::uuid)$$,'edit uses same operation');
SELECT is((SELECT title FROM activities WHERE id=current_setting('test.draft_id')::uuid),'Updated','edit changes title');
SELECT is((SELECT count(*) FROM activity_resources WHERE activity_id=current_setting('test.draft_id')::uuid),1::bigint,'edit replaces resources without duplication');

SELECT throws_ok($$SELECT save_teacher_activity_draft(jsonb_set(current_setting('test.draft_input')::jsonb,'{resources,0,url}','"https://fail.example"'))$$,'P0001','Injected resource failure','failed resource write rolls back Activity creation');
SELECT is((SELECT count(*) FROM activities WHERE title='Atomic draft'),0::bigint,'failed creation leaves no orphan draft');
SELECT throws_ok($$SELECT save_teacher_activity_draft(jsonb_set(current_setting('test.draft_input')::jsonb,'{resources,0,url}','"https://fail.example"'),current_setting('test.draft_id')::uuid)$$,'P0001','Injected resource failure','failed edit rolls back all operations');
SELECT is((SELECT title FROM activities WHERE id=current_setting('test.draft_id')::uuid),'Updated','failed edit preserves previous content');
SELECT is((SELECT title FROM activity_resources WHERE activity_id=current_setting('test.draft_id')::uuid),'Original','failed edit preserves deleted resource rows');
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"a9999999-9999-4999-8999-999999999999"}';
SELECT throws_ok($$SELECT save_teacher_activity_draft(current_setting('test.draft_input')::jsonb,current_setting('test.draft_id')::uuid)$$,'42501',NULL,'foreign teacher cannot edit');
RESET ROLE;
SET LOCAL "request.jwt.claims" = '{"role":"service_role"}';
SELECT lives_ok($$SELECT make_teacher_activity_ready_atomically(
 current_setting('test.draft_id')::uuid, 'free-response', (SELECT config_data FROM activities WHERE id=current_setting('test.draft_id')::uuid),
 (SELECT config_schema_version FROM activities WHERE id=current_setting('test.draft_id')::uuid),
 'a8888888-8888-4888-8888-888888888888','draft',false,
 (SELECT config_schema_version FROM activities WHERE id=current_setting('test.draft_id')::uuid))$$,'ready snapshots the complete saved draft');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"a8888888-8888-4888-8888-888888888888"}';
SELECT throws_ok($$SELECT save_teacher_activity_draft(current_setting('test.draft_input')::jsonb,current_setting('test.draft_id')::uuid)$$,'23514',NULL,'ready Activity cannot be edited');
SELECT is((SELECT title FROM activity_resources WHERE activity_id=current_setting('test.draft_id')::uuid AND version_id IS NOT NULL),'Original','ready snapshot resources remain intact');
SELECT * FROM finish();
ROLLBACK;

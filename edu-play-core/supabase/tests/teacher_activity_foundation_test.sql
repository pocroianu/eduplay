-- ============================================================================
-- Teacher-created Activity foundation: private visibility, owner RLS, and
-- free-response activity type metadata.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

SELECT has_column('public', 'activities', 'visibility_scope', 'activities.visibility_scope exists');
SELECT col_default_is('public', 'activities', 'visibility_scope', 'private', 'activities.visibility_scope defaults to private');
SELECT has_column('public', 'activity_types', 'renderer_kind', 'activity_types.renderer_kind exists');
SELECT has_column('public', 'activity_types', 'authoring_mode', 'activity_types.authoring_mode exists');
SELECT has_column('public', 'activity_types', 'produces_submission', 'activity_types.produces_submission exists');
SELECT has_column('public', 'activity_types', 'supports_review', 'activity_types.supports_review exists');
SELECT has_column('public', 'activity_types', 'is_auto_scored', 'activity_types.is_auto_scored exists');

SELECT is(
  (SELECT row(renderer_key, renderer_kind, authoring_mode, produces_submission, supports_review, is_auto_scored)::text
   FROM public.activity_types
   WHERE type_id = 'free-response'),
  '(free-response,react,teacher-simple,t,t,f)',
  'free-response metadata marks a native teacher-authorable review activity'
);

SET LOCAL row_security = on;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('55555555-5555-5555-5555-555555555555', 'teacher-a-foundation@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('66666666-6666-6666-6666-666666666666', 'teacher-b-foundation@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('77777777-7777-7777-7777-777777777777', 'admin-foundation@example.com',     '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
VALUES
  ('55555555-5555-5555-5555-555555555555', 'teacher-a-foundation@example.com', 'Teacher A Foundation', 'teacher'),
  ('66666666-6666-6666-6666-666666666666', 'teacher-b-foundation@example.com', 'Teacher B Foundation', 'teacher'),
  ('77777777-7777-7777-7777-777777777777', 'admin-foundation@example.com',     'Admin Foundation',     'admin')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO activities (id, template, title, status, is_published, visibility_scope, created_by, config_data, config_schema_version)
VALUES
  ('abababab-abab-abab-abab-abababababab', 'free-response',   'Teacher A draft', 'draft',     FALSE, 'private', '55555555-5555-5555-5555-555555555555', '{"prompt":"Scrie ceva.","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb, 1),
  ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 'free-response',   'Teacher A ready', 'published', TRUE,  'private', '55555555-5555-5555-5555-555555555555', '{"prompt":"Arată ce știi.","allowedTools":{"text":true,"drawing":true,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb, 1),
  ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', 'multiple-choice', 'Public ready',    'published', TRUE,  'public',  '77777777-7777-7777-7777-777777777777', '{"question":"Q","answerIndex":0}'::jsonb, 1);

INSERT INTO activity_versions (id, activity_id, version_number, config_data, config_schema_version, activity_type_id, published_by_user_id)
VALUES
  ('dededede-dede-dede-dede-dededededede', 'bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc', 1, '{"private":true}'::jsonb, 1, 'free-response', NULL),
  ('efefefef-efef-efef-efef-efefefefefef', 'cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd', 1, '{"public":true}'::jsonb, 1, 'multiple-choice', NULL);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"55555555-5555-5555-5555-555555555555"}';

SELECT bag_eq(
  $$ SELECT id FROM activities WHERE id IN ('abababab-abab-abab-abab-abababababab','bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc','cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd') $$,
  $$ VALUES ('abababab-abab-abab-abab-abababababab'::uuid),('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc'::uuid),('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd'::uuid) $$,
  'owner teacher sees own private activities and public library activities'
);

UPDATE activities SET config_data = jsonb_set(config_data, '{prompt}', '"Actualizat"'::jsonb)
WHERE id = 'abababab-abab-abab-abab-abababababab';
SELECT is(
  (SELECT config_data->>'prompt' FROM activities WHERE id = 'abababab-abab-abab-abab-abababababab'),
  'Actualizat',
  'owner teacher can update private draft config data'
);

PREPARE teacher_a_make_public AS
  UPDATE activities SET visibility_scope = 'public'
  WHERE id = 'abababab-abab-abab-abab-abababababab';
SELECT throws_ok('teacher_a_make_public', '42501', NULL, 'teacher cannot change private activity scope to public');

PREPARE teacher_a_mark_ready AS
  UPDATE activities SET status = 'published', is_published = TRUE
  WHERE id = 'abababab-abab-abab-abab-abababababab';
SELECT throws_ok('teacher_a_mark_ready', '42501', NULL, 'teacher cannot mark a draft ready/published directly');

SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"66666666-6666-6666-6666-666666666666"}';
SELECT bag_eq(
  $$ SELECT id FROM activities WHERE id IN ('abababab-abab-abab-abab-abababababab','bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc','cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd') $$,
  $$ VALUES ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd'::uuid) $$,
  'non-owner teacher cannot see another teacher private activities'
);

SELECT bag_eq(
  $$ SELECT activity_id FROM activity_versions WHERE activity_id IN ('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc','cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd') $$,
  $$ VALUES ('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd'::uuid) $$,
  'private ready activity_versions do not leak through public version RLS'
);

SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"77777777-7777-7777-7777-777777777777"}';
SELECT is(
  (SELECT count(*) FROM activities WHERE id IN ('abababab-abab-abab-abab-abababababab','bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc','cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd')),
  3::bigint,
  'admin sees all activities'
);

SET LOCAL ROLE postgres;
SELECT is(
  public.is_activity_published('bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc'),
  FALSE,
  'is_activity_published returns false for private ready activities'
);
SELECT is(
  public.is_activity_published('cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd'),
  TRUE,
  'is_activity_published returns true for public ready activities'
);

RESET ROLE;
RESET "request.jwt.claims";

SELECT * FROM finish();

ROLLBACK;

-- ============================================================================
-- Teacher-created Activity preview sessions.
-- Run with: supabase test db
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(4);

SET LOCAL row_security = on;

INSERT INTO auth.users (id, email, instance_id, aud, role)
VALUES
  ('12121212-1212-1212-1212-121212121212', 'teacher-preview-a@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('13131313-1313-1313-1313-131313131313', 'teacher-preview-b@example.com', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, email, full_name, role)
VALUES
  ('12121212-1212-1212-1212-121212121212', 'teacher-preview-a@example.com', 'Teacher Preview A', 'teacher'),
  ('13131313-1313-1313-1313-131313131313', 'teacher-preview-b@example.com', 'Teacher Preview B', 'teacher')
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO activities (id, template, title, status, is_published, visibility_scope, created_by, config_data, config_schema_version)
VALUES (
  '14141414-1414-1414-1414-141414141414',
  'free-response',
  'Teacher preview draft',
  'draft',
  FALSE,
  'private',
  '12121212-1212-1212-1212-121212121212',
  '{"prompt":"Arată ce ai învățat.","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
  1
);

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"12121212-1212-1212-1212-121212121212"}';

INSERT INTO activity_preview_sessions (id, activity_id, type_id, config_data, created_by, expires_at)
VALUES (
  '15151515-1515-1515-1515-151515151515',
  '14141414-1414-1414-1414-141414141414',
  'free-response',
  '{"prompt":"Preview","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
  '12121212-1212-1212-1212-121212121212',
  NOW() + INTERVAL '15 minutes'
);

SELECT is(
  (SELECT count(*) FROM activity_preview_sessions WHERE id = '15151515-1515-1515-1515-151515151515'),
  1::bigint,
  'owner teacher can create and read their own preview session'
);

SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"13131313-1313-1313-1313-131313131313"}';

SELECT is(
  (SELECT count(*) FROM activity_preview_sessions WHERE id = '15151515-1515-1515-1515-151515151515'),
  0::bigint,
  'another teacher cannot read a teacher preview session'
);

PREPARE other_teacher_preview_insert AS
  INSERT INTO activity_preview_sessions (activity_id, type_id, config_data, created_by, expires_at)
  VALUES (
    '14141414-1414-1414-1414-141414141414',
    'free-response',
    '{"prompt":"Nope","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    '12121212-1212-1212-1212-121212121212',
    NOW() + INTERVAL '15 minutes'
  );
SELECT throws_ok('other_teacher_preview_insert', '42501', NULL, 'teacher cannot create a preview session as another actor');

PREPARE other_teacher_other_activity_preview_insert AS
  INSERT INTO activity_preview_sessions (activity_id, type_id, config_data, created_by, expires_at)
  VALUES (
    '14141414-1414-1414-1414-141414141414',
    'free-response',
    '{"prompt":"Nope","allowedTools":{"text":true,"drawing":false,"voice":false},"shareWithFamilyOnApproval":false}'::jsonb,
    '13131313-1313-1313-1313-131313131313',
    NOW() + INTERVAL '15 minutes'
  );
SELECT throws_ok('other_teacher_other_activity_preview_insert', '42501', NULL, 'teacher cannot create a preview session for another teacher activity');

RESET ROLE;
RESET "request.jwt.claims";

SELECT * FROM finish();

ROLLBACK;

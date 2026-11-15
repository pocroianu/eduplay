import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
const run = promisify(execFile);
const args = [
  'exec',
  '-i',
  'supabase_db_edu-play-core',
  'psql',
  '-X',
  '-qAt',
  '-U',
  'postgres',
  '-d',
  'postgres',
  '-v',
  'ON_ERROR_STOP=1',
];
const teacher = randomUUID(),
  student = randomUUID(),
  instance = randomUUID(),
  submission = randomUUID();
function sql(query) {
  return execFileSync('docker', [...args, '-c', query], {
    encoding: 'utf8',
    timeout: 10000,
  }).trim();
}
const asService = 'SET LOCAL ROLE service_role;';
try {
  sql(`BEGIN;
    INSERT INTO auth.users(id,email,instance_id,aud,role) VALUES
    ('${teacher}','${teacher}@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    ('${student}','${student}@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
    INSERT INTO profiles(id,email,full_name,role) VALUES
    ('${teacher}','${teacher}@test.invalid','Teacher','teacher'),('${student}','${student}@test.invalid','Student','student')
    ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role;
    INSERT INTO students(id,username) VALUES('${student}','native-${student}');
    INSERT INTO activity_instances(id,type_id,config,assigned_to,created_by) VALUES
    ('${instance}','drawing-canvas','{}','${student}','${teacher}'); COMMIT;`);
  function request(path, delay = '') {
    return `BEGIN; ${asService} SELECT artifact_id FROM accept_native_activity_submission('${student}','${instance}','${submission}','drawing-canvas','${path}'); ${delay} COMMIT;`;
  }
  // A transaction remains open briefly after accepting, forcing the other
  // connection to serialize on the same instance instead of racing the insert.
  const first = run(
    'docker',
    [
      ...args,
      '-c',
      request(student + '/' + randomUUID() + '.png', 'SELECT pg_sleep(0.2);'),
    ],
    { timeout: 10000 },
  );
  const second = run(
    'docker',
    [...args, '-c', request(student + '/' + randomUUID() + '.png')],
    { timeout: 10000 },
  );
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.stdout.trim(), b.stdout.trim());
  assert.equal(
    sql(
      `SELECT count(*) FROM native_activity_submissions WHERE instance_id='${instance}'`,
    ),
    '1',
  );
  assert.equal(
    sql(`SELECT count(*) FROM child_artifacts WHERE student_id='${student}'`),
    '1',
  );
  console.log(
    'PASS: concurrent submissions return one durable artifact and receipt',
  );
} finally {
  sql(`BEGIN;
    SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"${teacher}"}';
    DELETE FROM child_artifacts WHERE student_id='${student}';
    DELETE FROM activity_instances WHERE id='${instance}';
    DELETE FROM audit_log WHERE actor_id IN ('${student}','${teacher}');
    SET LOCAL "request.jwt.claims" = '{}';
    DELETE FROM audit_logs WHERE changed_by IN ('${student}','${teacher}');
    DELETE FROM auth.users WHERE id IN ('${teacher}','${student}'); COMMIT;`);
}

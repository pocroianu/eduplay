// Local Postgres integration checks. Requires `supabase start` and the current
// migrations. Uses two persistent psql sessions; no extra database dependency.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

const container = "supabase_db_edu-play-core";
const args = [
  "exec",
  "-i",
  container,
  "psql",
  "-X",
  "-qAt",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
];
const teacher = randomUUID();
const student = randomUUID();
const classId = randomUUID();
const path = randomUUID();
const definitionPath = randomUUID();
const artifactId = randomUUID();
const first = randomUUID();
const second = randomUUID();
const label = `path-concurrency-${randomUUID()}`;

function sql(query) {
  return execFileSync("docker", args, {
    input: query,
    encoding: "utf8",
    timeout: 10000,
  }).trim();
}

function session(name) {
  const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
  let output = "";
  let errors = "";
  let pending;
  child.stderr.on("data", (data) => {
    errors += data;
  });
  child.stdout.on("data", (data) => {
    output += data;
    if (pending && output.includes(pending.marker)) {
      clearTimeout(pending.timeout);
      pending.resolve(output.slice(0, output.indexOf(pending.marker)));
      pending = undefined;
      output = "";
    }
  });
  child.on("error", (error) => pending?.reject(error));
  child.on("exit", (code) => {
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`psql exited ${code}: ${errors}`));
      pending = undefined;
    }
  });
  return {
    name,
    execute(query) {
      assert.equal(
        pending,
        undefined,
        "One statement batch per session at a time",
      );
      return new Promise((resolve, reject) => {
        const marker = randomUUID();
        const timeout = setTimeout(
          () => reject(new Error(`psql timed out: ${errors}`)),
          10000,
        );
        pending = { marker, resolve, reject, timeout };
        child.stdin.write(
          `SET application_name = '${name}';\n${query}\n\\echo ${marker}\n`,
        );
      });
    },
    close() {
      if (child.exitCode !== null) return Promise.resolve();
      child.stdin.end("ROLLBACK;\n\\q\n");
      return new Promise((resolve) => child.once("exit", resolve));
    },
  };
}

async function waitForLock(name) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (
      sql(
        `SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='${name}' AND wait_event_type='Lock');`,
      ) === "t"
    )
      return;
    await delay(25);
  }
  throw new Error("The competing transition did not wait for a database lock");
}

const advance = (stepId = first) => `SET LOCAL ROLE service_role;
SELECT advance_learning_path_progress('${student}', '${path}', '${stepId}');`;
const override = `SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"${teacher}"}';
SELECT override_learning_path_progress('${student}', '${path}', 'overridden');`;
const progress = () =>
  JSON.parse(
    sql(
      `SELECT row_to_json(p) FROM student_path_progress p WHERE student_id='${student}' AND path_id='${path}';`,
    ),
  );
const reset = () =>
  sql(
    `DELETE FROM student_path_progress WHERE student_id='${student}' AND path_id='${path}';`,
  );

let a;
let b;
try {
  sql(`BEGIN;
    INSERT INTO auth.users(id,email,instance_id,aud,role) VALUES
      ('${teacher}','${teacher}@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
      ('${student}','${student}@test.invalid','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
    INSERT INTO profiles(id,email,full_name,role) VALUES
      ('${teacher}','${teacher}@test.invalid','Concurrency teacher','teacher'),
      ('${student}','${student}@test.invalid','Concurrency student','student')
      ON CONFLICT(id) DO UPDATE SET role=EXCLUDED.role;
    INSERT INTO classes(id,teacher_id,name) VALUES ('${classId}','${teacher}','Concurrency test');
    INSERT INTO students(id,class_id,username) VALUES ('${student}','${classId}','${label}');
    INSERT INTO learning_paths(id,title,created_by,status) VALUES ('${path}','Concurrency path','${teacher}','published');
    INSERT INTO learning_path_steps(id,path_id,step_order,kind,target_activity_type,title) VALUES
      ('${first}','${path}',1,'activity_template','free-response','First'),
      ('${second}','${path}',2,'activity_template','free-response','Second');
    INSERT INTO learning_path_assignments(path_id,class_id,assigned_by) VALUES ('${path}','${classId}','${teacher}');
    COMMIT;`);
  a = session(`${label}-a`);
  b = session(`${label}-b`);

  // Both callers start while no committed progress exists. B must re-read A's
  // committed cursor, rather than reinitializing or completing the next step.
  await a.execute(`BEGIN; ${advance()}`);
  let waiting = b.execute(`BEGIN; ${advance()} COMMIT;`);
  await waitForLock(b.name);
  await a.execute("COMMIT;");
  await waiting;
  assert.equal(progress().current_step_id, second);
  assert.equal(progress().last_completed_step_id, first);
  assert.equal(
    Number(
      sql(
        `SELECT count(*) FROM student_path_progress WHERE student_id='${student}' AND path_id='${path}';`,
      ),
    ),
    1,
  );
  console.log("PASS: concurrent initialization and duplicate completion");

  // The teacher changes existing progress while completion of its current
  // second step is waiting. Advancement must check the committed override.
  await a.execute(`BEGIN; ${override}`);
  waiting = b.execute(`BEGIN; ${advance(second)} COMMIT;`);
  await waitForLock(b.name);
  await a.execute("COMMIT;");
  await waiting;
  assert.equal(progress().status, "overridden");
  assert.equal(progress().last_completed_step_id, null);
  console.log("PASS: overlapping completion preserves teacher override");

  // Reverse arrival order: a teacher override still applies after advancement.
  reset();
  await a.execute(`BEGIN; ${advance()}`);
  waiting = b.execute(`BEGIN; ${override} COMMIT;`);
  await waitForLock(b.name);
  await a.execute("COMMIT;");
  await waiting;
  assert.equal(progress().status, "overridden");
  assert.equal(progress().current_step_id, null);
  console.log("PASS: teacher override follows overlapping advancement");
  sql(`BEGIN;
    SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"${teacher}"}';
    INSERT INTO learning_paths(id,title,created_by) VALUES ('${definitionPath}','Authoring concurrency','${teacher}');
    INSERT INTO child_artifacts(id,student_id,class_id,artifact_type,storage_path)
      VALUES ('${artifactId}','${student}','${classId}','photo','concurrency/photo.png');
    COMMIT;`);
  const asTeacher = `SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"${teacher}"}';`;
  const append = `SELECT count(*) FROM append_learning_path_step('${definitionPath}','Append','free-response');`;
  const publish = `SELECT count(*) FROM publish_learning_path('${definitionPath}');`;
  const definition = () => JSON.parse(sql(`SELECT json_build_object(
    'status',(SELECT status FROM learning_paths WHERE id='${definitionPath}'),
    'orders',(SELECT json_agg(step_order ORDER BY step_order) FROM learning_path_steps WHERE path_id='${definitionPath}')
  );`));

  await a.execute(`BEGIN; ${asTeacher} ${append}`);
  waiting = b.execute(`BEGIN; ${asTeacher} ${append} COMMIT;`);
  await waitForLock(b.name);
  await a.execute("COMMIT;");
  await waiting;
  assert.deepEqual(definition().orders, [0,1]);
  console.log("PASS: concurrent appends both survive with database ordering");

  await a.execute(`BEGIN; ${asTeacher} ${publish}`);
  waiting = b.execute(`BEGIN; ${asTeacher}
    DO $$ BEGIN
      PERFORM append_learning_path_step('${definitionPath}','Too late','free-response');
      RAISE EXCEPTION 'expected append rejection';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'learning_path_not_draft' THEN RAISE; END IF;
    END $$; COMMIT;`);
  await waitForLock(b.name);
  await a.execute("COMMIT;");
  await waiting;
  assert.deepEqual(definition(), {status:"published", orders:[0,1]});
  console.log("PASS: publication rejects a waiting append");

  // Trusted fixture reset only: authenticated callers cannot reopen definitions.
  sql(`UPDATE learning_paths SET status='draft' WHERE id='${definitionPath}';`);
  await a.execute(`BEGIN; ${asTeacher} ${append}`);
  waiting = b.execute(`BEGIN; ${asTeacher} ${publish} COMMIT;`);
  await waitForLock(b.name);
  await a.execute("COMMIT;");
  await waiting;
  assert.deepEqual(definition(), {status:"published", orders:[0,1,2]});
  console.log("PASS: publication includes a committed waiting append");

  const publishArtifact = `SELECT became_family_visible FROM change_artifact_visibility('${artifactId}','family_visible');`;
  const winner = await a.execute(`BEGIN; ${asTeacher} ${publishArtifact}`);
  waiting = b.execute(`BEGIN; ${asTeacher} ${publishArtifact} COMMIT;`);
  await waitForLock(b.name);
  await a.execute("COMMIT;");
  const retry = await waiting;
  assert.equal(winner.trim(), "t");
  assert.equal(retry.trim(), "f");
  console.log("PASS: concurrent artifact publication authorizes only one notification attempt");

} finally {
  // Roll back/close both sessions before deleting committed test fixtures.
  await Promise.all([a?.close(), b?.close()]);
  sql(`BEGIN;
    SET LOCAL "request.jwt.claims" = '{"role":"authenticated","sub":"${teacher}"}';
    DELETE FROM child_artifacts WHERE id='${artifactId}';
    DELETE FROM audit_log WHERE artifact_id='${artifactId}';
    DELETE FROM learning_paths WHERE id IN ('${path}','${definitionPath}');
    DELETE FROM classes WHERE id='${classId}';
    SET LOCAL "request.jwt.claims" = '{}';
    DELETE FROM audit_logs WHERE changed_by IN ('${teacher}', '${student}');
    DELETE FROM auth.users WHERE id IN ('${teacher}', '${student}');
    COMMIT;`);
}

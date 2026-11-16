#!/usr/bin/env node
/**
 * Local Directus CMS helper.
 *
 *   node scripts/directus.mjs up      # bootstrap DB role + start Directus, wait for health
 *   node scripts/directus.mjs stop    # stop the Directus container (data is kept)
 *   node scripts/directus.mjs status  # container state + /server/health
 *   node scripts/directus.mjs logs    # follow container logs
 *
 * Requires the Supabase CLI stack (`npm run db:start`). On first run it writes
 * random local secrets to .env.directus (gitignored). Secrets are never printed.
 *
 * `up` is idempotent and non-destructive: it only enables LOGIN on the existing
 * `directus_admin` role (created NOLOGIN by the Supabase migrations) and sets
 * its password to the value in .env.directus. Directus creates its own system
 * tables in the `directus` schema on first boot and reuses them afterwards.
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.directus");
const COMPOSE_FILE = path.join(ROOT, "docker-compose.directus.yml");
const DB_CONTAINER = "supabase_db_edu-play-core";
const DIRECTUS_CONTAINER = "eduplay-directus";
const HEALTH_URL = "http://localhost:8055/server/health";
const HEALTH_TIMEOUT_MS = 180_000;
const CONFIG_DIR = path.join(ROOT, "directus");
const config = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, "config.json"), "utf8"));

const log = {
  info: (m) => console.log(`[directus] ${m}`),
  ok: (m) => console.log(`[directus] ✔ ${m}`),
  fail: (m) => console.error(`[directus] ✖ ${m}`),
};

function die(message) {
  log.fail(message);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", cwd: ROOT, ...opts });
}

function compose(args, opts) {
  return run(
    "docker",
    ["compose", "-f", COMPOSE_FILE, "--env-file", ENV_FILE, ...args],
    opts,
  );
}

function excludeTables() {
  const tables = psql(
    "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace " +
      "WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f') ORDER BY c.relname;",
    "list public collections",
  ).split("\n");
  return tables.filter((table) => table && !config.collections.includes(table)).join(",");
}

function cliSchema(action) {
  const file = path.join(CONFIG_DIR, "schema.json");
  const containerFile = action === "apply" ? "/directus/schema-config.json" : "/directus/schema-export.json";
  if (action === "apply") {
    const copy = run("docker", ["cp", file, `${DIRECTUS_CONTAINER}:${containerFile}`]);
    if (copy.status !== 0) die("Could not copy Directus schema into container.");
  }
  const args = ["exec", DIRECTUS_CONTAINER, "node", "cli.js", "schema", action, "--yes"];
  if (action === "snapshot") args.push("--format", "json");
  const result = run("docker", [...args, containerFile]);
  if (result.status !== 0) die(`Directus schema ${action} failed: ${(result.stderr || result.stdout).trim()}`);
  if (action === "snapshot") {
    const copy = run("docker", ["cp", `${DIRECTUS_CONTAINER}:${containerFile}`, file]);
    if (copy.status !== 0) die("Could not copy Directus snapshot from container.");
  }
  log.ok(`Schema ${action} complete`);
}

async function applyAccess(env) {
  async function request(route, method = "GET", data, token) {
    const response = await fetch(`http://localhost:8055${route}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = response.status === 204 ? {} : await response.json();
    if (!response.ok) die(`Directus ${method} ${route} failed (${response.status}): ${JSON.stringify(body.errors)}`);
    return body.data;
  }
  const login = await request("/auth/login", "POST", { email: env.DIRECTUS_ADMIN_EMAIL, password: env.DIRECTUS_ADMIN_PASSWORD });
  const token = login.access_token;
  const api = (route, method, data) => request(route, method, data, token);
  const collections = await api("/collections?limit=-1");
  for (const name of config.collections) {
    const collection = collections.find((entry) => entry.collection === name);
    if (!collection) die(`Allowlisted collection ${name} is missing from the database.`);
    if (!collection.meta) await api(`/collections/${name}`, "PATCH", { meta: {} });
  }
  const snapshot = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, "schema.json"), "utf8"));
  for (const field of snapshot.fields.filter((entry) => config.collections.includes(entry.collection))) {
    const current = await api(`/fields/${field.collection}/${field.field}`);
    if (!current.meta) await api(`/fields/${field.collection}/${field.field}`, "PATCH", { meta: {} });
  }
  const roles = await api("/roles?limit=-1");
  const existingRole = roles.find((role) => role.name === config.role.name);
  const role = existingRole ? await api(`/roles/${existingRole.id}`, "PATCH", config.role) : await api("/roles", "POST", config.role);
  const policies = await api("/policies?limit=-1");
  const existingPolicy = policies.find((policy) => policy.name === config.policy.name);
  const policy = existingPolicy ? await api(`/policies/${existingPolicy.id}`, "PATCH", config.policy) : await api("/policies", "POST", config.policy);
  const access = await api("/access?limit=-1");
  for (const entry of access.filter((entry) => entry.role === role.id && entry.policy !== policy.id)) {
    await api(`/access/${entry.id}`, "DELETE");
  }
  if (!access.some((entry) => entry.role === role.id && entry.policy === policy.id)) {
    await api("/access", "POST", { role: role.id, policy: policy.id });
  }
  // Reconcile the managed policy completely so stale permissions cannot survive.
  const permissions = await api(`/permissions?filter[policy][_eq]=${policy.id}&limit=-1`);
  const desired = [
    ...config.collections.map((collection) => ({ collection, action: "read" })),
    ...["create", "read", "update", "delete"].map((action) => ({ collection: "directus_files", action })),
  ];
  for (const permission of permissions) {
    const index = desired.findIndex((item) => item.collection === permission.collection && item.action === permission.action);
    if (index < 0) {
      await api(`/permissions/${permission.id}`, "DELETE");
    } else {
      await api(`/permissions/${permission.id}`, "PATCH", { fields: ["*"], permissions: {}, validation: {}, presets: null });
      desired.splice(index, 1);
    }
  }
  for (const item of desired) {
    await api("/permissions", "POST", { policy: policy.id, ...item, fields: ["*"] });
  }
  // TODO ADR 0007: title, description, thumbnail_url, category, catalog_visible,
  // sort_order only after a database-enforced public-catalog boundary exists.
  log.ok("Editor role, policy and permissions applied");
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function ensureEnvFile(storage = {}) {
  const existing = fs.existsSync(ENV_FILE)
    ? parseEnv(fs.readFileSync(ENV_FILE, "utf8"))
    : {};
  const defaults = {
    DIRECTUS_KEY: () => crypto.randomBytes(24).toString("hex"),
    DIRECTUS_SECRET: () => crypto.randomBytes(32).toString("hex"),
    DIRECTUS_DB_PASSWORD: () => crypto.randomBytes(24).toString("hex"),
    // Directus rejects reserved TLDs such as `.local`; use a syntactically valid address.
    DIRECTUS_ADMIN_EMAIL: () => "admin@example.com",
    DIRECTUS_ADMIN_PASSWORD: () => crypto.randomBytes(12).toString("hex"),
  };
  const missing = Object.keys(defaults).filter((k) => !existing[k]);
  const changed = Object.keys(storage).filter((k) => existing[k] !== storage[k]);
  if (missing.length === 0 && changed.length === 0) return existing;

  const values = { ...existing };
  for (const k of missing) values[k] = defaults[k]();
  Object.assign(values, storage);
  const body = [
    "# Local Directus secrets — generated by scripts/directus.mjs. Do not commit.",
    "# ADMIN_* only seed the first admin user; changing them later has no effect",
    "# on an already-bootstrapped Directus (change the password in Data Studio).",
    ...Object.entries(values).map(([k, v]) => `${k}=${v}`),
    "",
  ].join("\n");
  fs.writeFileSync(ENV_FILE, body, { mode: 0o600 });
  log.ok(`Updated local Directus configuration in ${path.relative(process.cwd(), ENV_FILE)}`);
  return values;
}

function supabaseStorage() {
  const res = run("npx", ["supabase", "status", "-o", "env"], {
    shell: process.platform === "win32",
  });
  if (res.status !== 0) die("Could not read Supabase status. Start the local stack first.");
  const status = parseEnv(res.stdout);
  const read = (key) => (status[key] ?? "").replace(/^"|"$/g, "");
  const url = read("STORAGE_S3_URL");
  const access = read("S3_PROTOCOL_ACCESS_KEY_ID");
  const secret = read("S3_PROTOCOL_ACCESS_KEY_SECRET");
  const region = read("S3_PROTOCOL_REGION");
  if (!url || !access || !secret || !region) {
    die("Supabase S3 protocol is unavailable. Enable storage.s3_protocol and restart Supabase.");
  }
  const endpoint = new URL(url);
  endpoint.hostname = "host.docker.internal";
  return {
    DIRECTUS_S3_ENDPOINT: endpoint.toString(),
    DIRECTUS_S3_ACCESS_KEY_ID: access,
    DIRECTUS_S3_SECRET_ACCESS_KEY: secret,
    DIRECTUS_S3_REGION: region,
  };
}

// Runs SQL as `postgres` and returns trimmed output, exiting on failure.
// SQL goes over stdin so secrets never appear in process arguments.
function psql(sql, purpose) {
  const res = run(
    "docker",
    ["exec", "-i", DB_CONTAINER, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-Atq"],
    { input: sql },
  );
  if (res.status !== 0) die(`Could not ${purpose}: ${res.stderr.trim()}`);
  return res.stdout.trim();
}

function ensureDatabase(env) {
  const state = run("docker", ["inspect", "-f", "{{.State.Health.Status}}", DB_CONTAINER]);
  if (state.status !== 0 || state.stdout.trim() !== "healthy") {
    die(`Supabase DB container ${DB_CONTAINER} is not running/healthy. Run: npm run db:start`);
  }

  const bootstrapped = psql(
    "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'directus_admin')" +
      " AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'directus');",
    "query database",
  );
  if (bootstrapped !== "t") {
    die(
      "directus_admin role or directus schema missing — apply migrations (npm run db:reset or supabase migration up --local).",
    );
  }

  const password = env.DIRECTUS_DB_PASSWORD;
  if (!/^[A-Za-z0-9._~-]+$/.test(password)) {
    die("DIRECTUS_DB_PASSWORD must only contain [A-Za-z0-9._~-]");
  }
  psql(`ALTER ROLE directus_admin WITH LOGIN PASSWORD '${password}';`, "enable directus_admin login");
  log.ok("directus_admin role has LOGIN with the configured password");
}

// Directus only creates the first admin during its initial install. If that step
// failed (e.g. an invalid ADMIN_EMAIL) the schema is installed but there is no
// user, so create one from the container's own ADMIN_* env (no secrets in argv).
function ensureAdminUser() {
  const userCount = psql("SELECT count(*) FROM directus.directus_users;", "read directus.directus_users");
  if (userCount !== "0") return;

  const role = psql(
    "SELECT r.id FROM directus.directus_roles r" +
      " JOIN directus.directus_access a ON a.role = r.id" +
      " JOIN directus.directus_policies p ON p.id = a.policy" +
      " WHERE p.admin_access ORDER BY r.name LIMIT 1;",
    "find the Directus admin role",
  );
  if (!/^[0-9a-f-]{36}$/.test(role)) die("No Directus role with admin access found; cannot create admin user.");
  log.info("No Directus users found — creating the admin user…");
  const res = run("docker", [
    "exec", DIRECTUS_CONTAINER, "sh", "-c",
    `node cli.js users create --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD" --role ${role}`,
  ]);
  if (res.status !== 0) die(`Admin user creation failed: ${(res.stderr || res.stdout).trim()}`);
  log.ok("Admin user created");
}

async function health() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok && body.status === "ok", status: res.status, body };
  } catch (err) {
    return { ok: false, error: err.cause?.code ?? err.message };
  }
}

async function waitForHealth() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let last;
  while (Date.now() < deadline) {
    last = await health();
    if (last.ok) return last;
    await new Promise((r) => setTimeout(r, 3000));
  }
  return last;
}

async function up() {
  const env = ensureEnvFile(supabaseStorage());
  ensureDatabase(env);
  process.env.DIRECTUS_EXCLUDE_TABLES = excludeTables();
  log.info("Starting Directus container…");
  const res = compose(["up", "-d"], { stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);

  log.info(`Waiting for ${HEALTH_URL} (first boot installs system tables)…`);
  const result = await waitForHealth();
  if (!result?.ok) {
    die(`Directus did not become healthy: ${JSON.stringify(result)}. Inspect with: npm run directus:logs`);
  }
  ensureAdminUser();
  await applyAccess(env);
  cliSchema("apply");
  log.ok("Directus is healthy at http://localhost:8055");
  log.info(`Admin login: ${env.DIRECTUS_ADMIN_EMAIL} (password in .env.directus)`);
}

async function status() {
  if (fs.existsSync(ENV_FILE)) compose(["ps"], { stdio: "inherit" });
  const result = await health();
  if (!result.ok) die(`health: DOWN ${JSON.stringify(result)}`);
  log.ok("health: ok");
}

const cmd = process.argv[2] ?? "up";
switch (cmd) {
  case "up":
    await up();
    break;
  case "stop": {
    if (!fs.existsSync(ENV_FILE)) break;
    const res = compose(["stop"], { stdio: "inherit" });
    if (res.status !== 0) process.exit(res.status ?? 1);
    break;
  }
  case "status":
    await status();
    break;
  case "snapshot":
    cliSchema("snapshot");
    break;
  case "logs":
    ensureEnvFile();
    compose(["logs", "-f", "--tail", "200"], { stdio: "inherit" });
    break;
  default:
    die(`Unknown command: ${cmd} (use up | stop | status | logs)`);
}

#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import activityPackages from './lib/activity-package.cjs';

const { readActivityPackage, assertValidActivityPackage } = activityPackages;

export function importActivityPackage(options) {
  const packageRoot = resolve(options.packageRoot);
  const repoRoot = resolve(options.repoRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const overwrite = options.overwrite === true;
  const result = assertValidActivityPackage(readActivityPackage(packageRoot, packageRoot), 'Invalid Activity package');
  const activity = result.activity;
  const selected = result.versions.find(entry => entry.version === activity.version);
  const activityDest = join(repoRoot, 'activities', activity.activityId);
  const versionDest = join(activityDest, 'versions', String(activity.version));
  if (existsSync(versionDest) && !overwrite) {
    throw new Error(`Activity version already exists: ${activity.activityId}@${activity.version}`);
  }

  const pins = new Map();
  for (const pin of selected.pins) {
    const existingPin = pins.get(pin.relativePath);
    if (existingPin && existingPin.sha256 !== pin.sha256) {
      throw new Error(`Conflicting pins for ${pin.relativePath}`);
    }
    pins.set(pin.relativePath, pin);
  }
  const writes = [];
  for (const pin of pins.values()) {
    const destination = join(repoRoot, pin.relativePath);
    if (existsSync(destination)) {
      const digest = createHash('sha256').update(readFileSync(destination)).digest('hex');
      if (digest === pin.sha256) continue;
      if (!overwrite) throw new Error(`Asset library conflict for ${pin.relativePath}`);
    }
    writes.push({ source: pin.source, destination });
  }
  writes.push({ source: selected.root, destination: versionDest });
  writes.push({ content: JSON.stringify(activity, null, 2) + '\n', destination: join(activityDest, 'activity.json') });

  mkdirSync(repoRoot, { recursive: true });
  const staging = mkdtempSync(join(repoRoot, '.activity-import-'));
  const applied = [];
  try {
    // Finish all copies before touching any published destination.
    writes.forEach((write, index) => {
      write.staged = join(staging, String(index));
      write.backup = join(staging, `backup-${index}`);
      if (write.source) cpSync(write.source, write.staged, { recursive: true });
      else writeFileSync(write.staged, write.content);
    });
    for (const write of writes) {
      const target = relative(repoRoot, resolve(write.destination));
      if (target.startsWith('..') || isAbsolute(target)) throw new Error('Import destination escapes repository');
      mkdirSync(dirname(write.destination), { recursive: true });
      write.hadOriginal = existsSync(write.destination);
      if (write.hadOriginal) renameSync(write.destination, write.backup);
      applied.push(write);
      renameSync(write.staged, write.destination);
    }
  } catch (error) {
    // Leave recovery files intact if rollback itself cannot finish.
    try {
      for (const write of applied.reverse()) {
        rmSync(write.destination, { recursive: true, force: true });
        if (write.hadOriginal) renameSync(write.backup, write.destination);
      }
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], `Import rollback failed; recovery files: ${staging}`);
    }
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  try {
    rmSync(staging, { recursive: true, force: true });
  } catch {
    console.warn(`Activity import completed; staging cleanup required: ${staging}`);
  }
  return {
    activityId: activity.activityId,
    version: activity.version,
    activityPath: join(activityDest, 'activity.json'),
    versionPath: versionDest,
  };
}

function parseCliArgs(argv) {
  const args = [...argv];
  const packageRoot = args.shift();
  if (!packageRoot || packageRoot === "--help" || packageRoot === "-h") {
    return { help: true };
  }

  const parsed = { packageRoot, repoRoot: undefined, overwrite: false };
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--repo") {
      parsed.repoRoot = args.shift();
    } else if (arg === "--overwrite") {
      parsed.overwrite = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = parseCliArgs(process.argv.slice(2));
    if (args.help) {
      console.log("Usage: node scripts/import-activity-package.mjs <package-root> [--repo <repo-root>] [--overwrite]");
      process.exit(0);
    }
    const result = importActivityPackage(args);
    console.log(`Imported Activity ${result.activityId}@${result.version}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

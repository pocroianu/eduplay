#!/usr/bin/env node
import { createRequire } from "node:module";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

function loadValidationSchemas() {
  try {
    const validation = require("@edu-play/validation");
    if (validation.activityAssetRegistrySchema && validation.activityMetadataSchema && validation.validateActivityAssetPins) {
      return validation;
    }
  } catch {
    // Fall through to source import for fresh checkouts without built validation dist.
  }

  require("ts-node/register");
  return require(resolve(dirname(fileURLToPath(import.meta.url)), "../packages/validation/src"));
}

const {
  activityAssetRegistrySchema,
  activityMetadataSchema,
  validateActivityAssetPins,
} = loadValidationSchemas();

export function importActivityPackage(options) {
  const packageRoot = resolve(options.packageRoot);
  const repoRoot = resolve(options.repoRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  const overwrite = options.overwrite === true;

  const activityPath = join(packageRoot, "activity.json");
  const activityResult = activityMetadataSchema.safeParse(readJson(activityPath));
  if (!activityResult.success) {
    throw new Error(`Invalid activity metadata in ${activityPath}: ${formatZodError(activityResult.error)}`);
  }

  const activity = activityResult.data;
  assertSafeActivityId(activity.activityId, "activityId");
  assertSafeActivityId(activity.gameId, "gameId");
  const versionDir = join(packageRoot, "versions", String(activity.version));
  if (!existsSync(versionDir) || !statSync(versionDir).isDirectory()) {
    throw new Error(`Missing Activity package version content: ${activity.activityId}@${activity.version}`);
  }

  const configPath = join(versionDir, "config.json");
  if (!existsSync(configPath)) {
    throw new Error(`Missing Activity package config: ${activity.activityId}@${activity.version} config.json`);
  }

  validateConfigFile(configPath, activity);
  validateStringFiles(join(versionDir, "strings"), activity);

  const assetsPath = join(versionDir, "assets.json");
  const assetsResult = activityAssetRegistrySchema.safeParse(readJson(assetsPath));
  if (!assetsResult.success) {
    throw new Error(`Invalid Activity package asset manifest for ${activity.activityId}@${activity.version}: ${formatZodError(assetsResult.error)}`);
  }

  const pinResult = validateActivityAssetPins(assetsResult.data, activity.gameId);
  if (!pinResult.success) {
    throw new Error(`Invalid Activity package asset manifest for ${activity.activityId}@${activity.version}: ${pinResult.errors.join("; ")}`);
  }

  const activityDest = join(repoRoot, "activities", activity.activityId);
  const versionDest = join(activityDest, "versions", String(activity.version));
  if (existsSync(versionDest) && !overwrite) {
    throw new Error(`Activity version already exists: ${activity.activityId}@${activity.version}`);
  }

  copyPinnedLibraryAssets({ packageRoot, repoRoot, registry: assetsResult.data, overwrite });

  if (overwrite && existsSync(versionDest)) {
    rmSync(versionDest, { recursive: true, force: true });
  }

  mkdirSync(join(activityDest, "versions"), { recursive: true });
  writeFileSync(join(activityDest, "activity.json"), `${JSON.stringify(activity, null, 2)}\n`);
  cpSync(versionDir, versionDest, { recursive: true });

  return {
    activityId: activity.activityId,
    version: activity.version,
    activityPath: join(activityDest, "activity.json"),
    versionPath: versionDest,
  };
}

function assertSafeActivityId(value, label) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) {
    throw new Error(`Invalid Activity package ${label}: expected a safe slug, got ${value}`);
  }
}

function validateConfigFile(configPath, activity) {
  const { parseGameConfig } = loadValidationSchemas();
  const result = parseGameConfig(readJson(configPath));
  if (!result.success) {
    throw new Error(`Invalid Activity package config for ${activity.activityId}@${activity.version}: ${formatZodError(result.error)}`);
  }
}

function validateStringFiles(stringsDir, activity) {
  const { gameStringsSchema } = loadValidationSchemas();
  if (!existsSync(stringsDir)) return;

  for (const entry of readdirSync(stringsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const stringPath = join(stringsDir, entry.name);
    const result = gameStringsSchema.safeParse(readJson(stringPath));
    if (!result.success) {
      throw new Error(`Invalid Activity package strings for ${activity.activityId}@${activity.version} ${entry.name}: ${formatZodError(result.error)}`);
    }
  }
}

function copyPinnedLibraryAssets({ packageRoot, repoRoot, registry, overwrite }) {
  for (const pin of Object.values(registry.pinnedAssets ?? {})) {
    const relativeLibraryPath = pin.path.replace(/^\//, "");
    const sourcePath = join(packageRoot, relativeLibraryPath);
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing pinned asset file in Activity package: ${pin.path}`);
    }

    const actualSha = sha256File(sourcePath);
    if (actualSha !== pin.sha256) {
      throw new Error(`Pinned asset hash mismatch for ${pin.path}: expected ${pin.sha256}, got ${actualSha}`);
    }

    const destPath = join(repoRoot, relativeLibraryPath);
    if (existsSync(destPath)) {
      const existingSha = sha256File(destPath);
      if (existingSha !== pin.sha256 && !overwrite) {
        throw new Error(`Asset library conflict for ${pin.path}: existing sha256 ${existingSha}, package sha256 ${pin.sha256}`);
      }
      if (existingSha === pin.sha256) continue;
    }

    mkdirSync(dirname(destPath), { recursive: true });
    cpSync(sourcePath, destPath);
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function formatZodError(error) {
  return JSON.stringify(error.format());
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

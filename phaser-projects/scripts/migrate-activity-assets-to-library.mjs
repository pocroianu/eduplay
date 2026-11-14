#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeAssetExtensions = new Map([
  [".png", { type: "image", libraryDir: "images" }],
  [".mp3", { type: "audio", libraryDir: "audio" }],
  [".wav", { type: "audio", libraryDir: "audio" }]
]);
const legacyAssetPackFiles = ["asset-pack.json", "preload-asset-pack.json"];

function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    printUsage();
    return 0;
  }

  const result = migrateActivityAssetsToLibrary({ root: options.root });
  console.log(
    `Migrated ${result.localBlobsMigrated} local asset blobs into ${result.libraryBlobsWritten} semantic library files across ${result.manifestsUpdated} manifests; removed ${result.legacyAssetPacksRemoved} legacy asset packs and ${result.hashNamedBlobsRemoved} hash-named library blobs.`
  );
  return 0;
}

export function migrateActivityAssetsToLibrary({ root = repoRoot } = {}) {
  const rootDir = resolve(root);
  const activitiesRoot = join(rootDir, "activities");
  const stats = {
    localBlobsMigrated: 0,
    libraryBlobsWritten: 0,
    manifestsUpdated: 0,
    legacyAssetPacksRemoved: 0,
    hashNamedBlobsRemoved: 0
  };

  for (const manifestPath of findActivityAssetManifests(activitiesRoot)) {
    const versionRoot = dirname(manifestPath);
    const assetsRoot = join(versionRoot, "assets");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const pinnedAssets = { ...(manifest.pinnedAssets ?? {}) };
    let changed = pruneLegacyLookupMaps(manifest);

    if (existsSync(assetsRoot)) {
      stats.legacyAssetPacksRemoved += removeLegacyAssetPacks(assetsRoot);
    }

    const blobs = existsSync(assetsRoot)
      ? listFiles(assetsRoot)
        .map((filePath) => ({ filePath, extension: extname(filePath).toLowerCase() }))
        .filter(({ extension }) => runtimeAssetExtensions.has(extension))
      : [];

    for (const { filePath, extension } of blobs) {
      const key = basename(filePath, extname(filePath));
      const bytes = readFileSync(filePath);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const pin = ensureSemanticLibraryPin({ rootDir, key, extension, sha256, sourcePath: filePath, stats });

      if (JSON.stringify(pinnedAssets[key]) !== JSON.stringify(pin)) {
        pinnedAssets[key] = pin;
        changed = true;
      }

      rmSync(filePath);
      stats.localBlobsMigrated += 1;
    }

    for (const [key, pin] of Object.entries(pinnedAssets)) {
      if (!isRuntimePin(pin)) continue;
      const extension = extname(pin.path).toLowerCase();
      const sourcePath = join(rootDir, pin.path.slice(1));
      const semanticPin = ensureSemanticLibraryPin({
        rootDir,
        key,
        extension,
        sha256: pin.sha256,
        sourcePath: existsSync(sourcePath) ? sourcePath : null,
        stats
      });
      if (JSON.stringify(pin) !== JSON.stringify(semanticPin)) {
        pinnedAssets[key] = semanticPin;
        changed = true;
      }
    }

    if (changed) {
      manifest.pinnedAssets = sortRecordByKey(pinnedAssets);
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      stats.manifestsUpdated += 1;
    }
  }

  stats.hashNamedBlobsRemoved += removeHashNamedLibraryBlobs(join(rootDir, "assets", "library"));
  return stats;
}

function ensureSemanticLibraryPin({ rootDir, key, extension, sha256, sourcePath, stats }) {
  const metadata = runtimeAssetExtensions.get(extension);
  if (!metadata) throw new Error(`Unsupported runtime asset extension for ${key}: ${extension}`);

  const fileName = semanticFileName(key, extension);
  const libraryRelativePath = join("assets", "library", metadata.libraryDir, fileName).replaceAll("\\", "/");
  const libraryPath = join(rootDir, libraryRelativePath);
  const pin = {
    type: metadata.type,
    assetId: `sha256-${sha256}`,
    sha256,
    path: `/${libraryRelativePath}`
  };

  if (existsSync(libraryPath)) {
    const actualSha = sha256File(libraryPath);
    if (actualSha !== sha256) {
      throw new Error(`Semantic library filename conflict for ${pin.path}: existing sha256 ${actualSha}, new sha256 ${sha256}`);
    }
    return pin;
  }

  if (!sourcePath) {
    throw new Error(`Missing source blob for semantic library pin ${key} (${pin.path})`);
  }

  const sourceSha = sha256File(sourcePath);
  if (sourceSha !== sha256) {
    throw new Error(`Source hash mismatch for ${sourcePath}: expected ${sha256}, got ${sourceSha}`);
  }

  mkdirSync(dirname(libraryPath), { recursive: true });
  copyFileSync(sourcePath, libraryPath);
  stats.libraryBlobsWritten += 1;
  return pin;
}

function semanticFileName(key, extension) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key)) {
    throw new Error(`Asset key cannot be used as a semantic library filename: ${key}`);
  }
  if (/^sha256-[a-f0-9]{64}$/i.test(key)) {
    throw new Error(`Asset key must not be a hash-only semantic library filename: ${key}`);
  }
  return `${key}${extension}`;
}

function isRuntimePin(pin) {
  return pin && (pin.type === "image" || pin.type === "audio") && typeof pin.path === "string" && typeof pin.sha256 === "string";
}

function findActivityAssetManifests(activitiesRoot) {
  const manifests = [];
  for (const activityId of listDirectories(activitiesRoot)) {
    const versionsRoot = join(activitiesRoot, activityId, "versions");
    for (const version of listDirectories(versionsRoot)) {
      const manifestPath = join(versionsRoot, version, "assets.json");
      if (existsSync(manifestPath)) manifests.push(manifestPath);
    }
  }
  return manifests.sort((a, b) => relative(activitiesRoot, a).localeCompare(relative(activitiesRoot, b)));
}

function listDirectories(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .map((entry) => join(root, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((entryPath) => basename(entryPath))
    .sort();
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root)) {
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else if (stats.isFile()) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

function pruneLegacyLookupMaps(manifest) {
  let changed = false;
  for (const legacyKey of ["categories", "shared"]) {
    if (Object.prototype.hasOwnProperty.call(manifest, legacyKey)) {
      delete manifest[legacyKey];
      changed = true;
    }
  }
  return changed;
}

function removeLegacyAssetPacks(assetsRoot) {
  let removed = 0;
  for (const fileName of legacyAssetPackFiles) {
    const assetPackPath = join(assetsRoot, fileName);
    if (existsSync(assetPackPath)) {
      rmSync(assetPackPath);
      removed += 1;
    }
  }
  return removed;
}

function removeHashNamedLibraryBlobs(libraryRoot) {
  let removed = 0;
  for (const libraryDir of [join(libraryRoot, "images"), join(libraryRoot, "audio")]) {
    if (!existsSync(libraryDir)) continue;
    for (const entry of readdirSync(libraryDir)) {
      if (/^sha256-[a-f0-9]{64}\.(png|mp3|wav)$/i.test(entry)) {
        rmSync(join(libraryDir, entry));
        removed += 1;
      }
    }
  }
  return removed;
}

function sortRecordByKey(record) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function parseArgs(argv) {
  const options = { root: repoRoot, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) throw new Error("--root requires a directory");
      options.root = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function printUsage() {
  console.log(`Usage: node scripts/migrate-activity-assets-to-library.mjs [--root <repo-root>]\n\nScans activities/*/versions/*/assets for .png, .mp3, and .wav blobs, copies them to assets/library under semantic asset-key filenames, rewrites Activity-version assets.json pinnedAssets with sha256 integrity metadata, removes migrated local blobs, prunes top-level categories/shared lookup maps, and drops legacy Phaser asset-pack files that point at those local blobs.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

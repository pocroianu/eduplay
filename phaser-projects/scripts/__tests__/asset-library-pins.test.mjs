import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const activitiesRoot = join(repoRoot, "activities");

test("Activity-version runtime blobs have migrated to immutable library pins", () => {
  assert.deepEqual(findRuntimeBlobs(activitiesRoot), []);
});

test("Activity-version assets folders do not keep legacy Phaser asset packs", () => {
  assert.deepEqual(findLegacyAssetPacks(activitiesRoot), []);
});

test("Activity-version asset manifests do not keep legacy category/shared lookup maps", () => {
  const offenders = [];

  for (const manifestPath of findActivityAssetManifests()) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const legacyKey of ["categories", "shared"]) {
      if (Object.prototype.hasOwnProperty.call(manifest, legacyKey)) {
        offenders.push(`${relativeRepoPath(manifestPath)} has top-level ${legacyKey}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("selected Activity game asset keys have matching immutable pins", () => {
  const failures = [];

  for (const manifestPath of findActivityAssetManifests()) {
    const versionRoot = dirname(manifestPath);
    const activityRoot = dirname(dirname(versionRoot));
    const activity = JSON.parse(readFileSync(join(activityRoot, "activity.json"), "utf8"));
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    collectSelectedGamePinFailures(manifest, activity.gameId, relativeRepoPath(manifestPath), failures);
  }

  assert.deepEqual(failures, []);
});

test("Activity asset pins point at existing immutable library blobs with matching hashes", () => {
  const failures = [];

  for (const activityId of listDirectories(activitiesRoot)) {
    const versionsRoot = join(activitiesRoot, activityId, "versions");
    for (const version of listDirectories(versionsRoot)) {
      const manifestPath = join(versionsRoot, version, "assets.json");
      if (!existsSync(manifestPath)) continue;

      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      for (const [key, pin] of Object.entries(manifest.pinnedAssets ?? {})) {
        const path = typeof pin.path === "string" ? pin.path : "";
        if (!path.startsWith("/assets/library/")) {
          failures.push(`${activityId}@${version}:${key} path is not under /assets/library`);
          continue;
        }
        if (pin.type === "image" && path !== `/assets/library/images/${key}.png`) {
          failures.push(`${activityId}@${version}:${key} image path is not semantic: ${path}`);
          continue;
        }
        if (pin.type === "audio" && ![`/assets/library/audio/${key}.mp3`, `/assets/library/audio/${key}.wav`].includes(path)) {
          failures.push(`${activityId}@${version}:${key} audio path is not semantic: ${path}`);
          continue;
        }
        if (/\/sha256-[a-f0-9]{64}\.(png|mp3|wav)$/i.test(path)) {
          failures.push(`${activityId}@${version}:${key} path is hash-named instead of semantic: ${path}`);
          continue;
        }

        const blobPath = join(repoRoot, path.slice(1));
        if (!existsSync(blobPath)) {
          failures.push(`${activityId}@${version}:${key} missing ${path}`);
          continue;
        }

        const actualSha = createHash("sha256").update(readFileSync(blobPath)).digest("hex");
        if (actualSha !== pin.sha256 || pin.assetId !== `sha256-${actualSha}`) {
          failures.push(`${activityId}@${version}:${key} hash mismatch for ${path}`);
        }

        const versionAssetsRoot = join(versionsRoot, version, "assets");
        for (const localBlobPath of findLocalRuntimeBlobs(versionAssetsRoot, key, pin.type)) {
          failures.push(`${activityId}@${version}:${key} is pinned but still has local blob ${localBlobPath}`);
        }
      }
    }
  }

  assert.deepEqual(failures, []);
});

function listDirectories(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .map((entry) => join(root, entry))
    .filter((entryPath) => statSync(entryPath).isDirectory())
    .map((entryPath) => entryPath.slice(root.length + 1));
}

function findActivityAssetManifests() {
  const manifests = [];
  for (const activityId of listDirectories(activitiesRoot)) {
    const versionsRoot = join(activitiesRoot, activityId, "versions");
    for (const version of listDirectories(versionsRoot)) {
      const manifestPath = join(versionsRoot, version, "assets.json");
      if (existsSync(manifestPath)) manifests.push(manifestPath);
    }
  }
  return manifests.sort();
}

function collectSelectedGamePinFailures(manifest, gameId, label, failures) {
  const gameEntry = manifest.games?.[gameId];
  if (!gameEntry) {
    failures.push(`${label}: games.${gameId} is missing`);
    return;
  }

  const sharedGroupManifests = [];
  for (const groupName of gameEntry.sharedGroups ?? []) {
    const groupManifest = manifest.sharedGroups?.[groupName];
    if (!groupManifest) {
      failures.push(`${label}: games.${gameId}.sharedGroups.${groupName} is missing`);
      continue;
    }
    sharedGroupManifests.push({ path: `sharedGroups.${groupName}`, manifest: groupManifest });
  }

  collectManifestPinFailures(manifest, gameEntry.manifest, `games.${gameId}.manifest`, label, failures);
  for (const group of sharedGroupManifests) {
    collectManifestPinFailures(manifest, group.manifest, group.path, label, failures);
  }

  for (const [variationId, variation] of Object.entries(gameEntry.variations ?? {})) {
    if (variation.manifest) {
      collectManifestPinFailures(manifest, normalizeManifest(variation.manifest), `games.${gameId}.variations.${variationId}.manifest`, label, failures);
    }
    for (const groupName of variation.sharedGroups ?? []) {
      const groupManifest = manifest.sharedGroups?.[groupName];
      if (!groupManifest) {
        failures.push(`${label}: games.${gameId}.variations.${variationId}.sharedGroups.${groupName} is missing`);
        continue;
      }
      collectManifestPinFailures(manifest, groupManifest, `sharedGroups.${groupName}`, label, failures);
    }
  }
}

function collectManifestPinFailures(manifest, assetManifest, path, label, failures) {
  for (const key of assetManifest.images ?? []) {
    collectPinFailure(manifest, key, "image", `${path}.images.${key}`, label, failures);
  }
  for (const key of assetManifest.audio ?? []) {
    collectPinFailure(manifest, key, "audio", `${path}.audio.${key}`, label, failures);
  }
}

function collectPinFailure(manifest, key, type, path, label, failures) {
  const pin = manifest.pinnedAssets?.[key];
  if (!pin) {
    failures.push(`${label}: ${path} is missing a ${type} pin`);
  } else if (pin.type !== type) {
    failures.push(`${label}: ${path} has a ${pin.type} pin, expected ${type}`);
  }
}

function normalizeManifest(manifest) {
  return {
    images: manifest.images ?? [],
    audio: manifest.audio ?? [],
    spritesheets: manifest.spritesheets ?? []
  };
}

function relativeRepoPath(filePath) {
  return filePath.slice(repoRoot.length + 1).replace(/\\/g, "/");
}

function findLocalRuntimeBlobs(root, key, type) {
  if (!existsSync(root)) return [];
  const extensions = type === "audio" ? [".mp3", ".wav"] : [".png"];
  return findRuntimeBlobs(root).filter((entryPath) => {
    const entry = basename(entryPath);
    return extensions.some((extension) => entry === `${key}${extension}`);
  });
}

function findRuntimeBlobs(root) {
  if (!existsSync(root)) return [];
  const matches = [];
  for (const entry of readdirSync(root)) {
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      matches.push(...findRuntimeBlobs(entryPath));
    } else if (/\.(png|mp3|wav)$/i.test(entry)) {
      matches.push(entryPath);
    }
  }
  return matches.sort();
}

function findLegacyAssetPacks(root) {
  if (!existsSync(root)) return [];
  const matches = [];
  for (const entry of readdirSync(root)) {
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      matches.push(...findLegacyAssetPacks(entryPath));
    } else if (entry === "asset-pack.json" || entry === "preload-asset-pack.json") {
      matches.push(entryPath);
    }
  }
  return matches.sort();
}

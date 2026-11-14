import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scriptPath = join(repoRoot, "scripts/migrate-activity-assets-to-library.mjs");

test("migrates Activity-local image and audio blobs into semantic library pins with sha256 integrity", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "activity-asset-migration-"));
  const firstVersion = join(fixtureRoot, "activities/fruits-01/versions/1");
  const secondVersion = join(fixtureRoot, "activities/food-01/versions/1");
  mkdirSync(join(firstVersion, "assets"), { recursive: true });
  mkdirSync(join(secondVersion, "assets"), { recursive: true });

  const image = Buffer.from("fake png bytes");
  const audio = Buffer.from("fake mp3 bytes");
  writeFileSync(join(firstVersion, "assets/apple.png"), image);
  writeFileSync(join(firstVersion, "assets/question1.mp3"), audio);
  writeFileSync(join(secondVersion, "assets/apple.png"), image);
  writeFileSync(join(firstVersion, "assets/asset-pack.json"), "{}\n");

  writeFileSync(join(firstVersion, "assets.json"), JSON.stringify(assetManifest("fruits-01", ["apple"], ["question1"]), null, 2));
  writeFileSync(join(secondVersion, "assets.json"), JSON.stringify(assetManifest("food-01", ["apple"], []), null, 2));

  const result = spawnSync(process.execPath, [scriptPath, "--root", fixtureRoot], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /migrated 3 local asset blobs/i);

  const imageSha = createHash("sha256").update(image).digest("hex");
  const audioSha = createHash("sha256").update(audio).digest("hex");
  assert.ok(existsSync(join(fixtureRoot, `assets/library/images/apple.png`)));
  assert.ok(existsSync(join(fixtureRoot, `assets/library/audio/question1.mp3`)));
  assert.equal(existsSync(join(firstVersion, "assets/apple.png")), false);
  assert.equal(existsSync(join(firstVersion, "assets/question1.mp3")), false);
  assert.equal(existsSync(join(secondVersion, "assets/apple.png")), false);
  assert.equal(existsSync(join(firstVersion, "assets/asset-pack.json")), false, "legacy asset packs are removed because they point at local blobs");

  const firstManifest = JSON.parse(readFileSync(join(firstVersion, "assets.json"), "utf8"));
  assert.equal(firstManifest.categories, undefined);
  assert.equal(firstManifest.shared, undefined);
  assert.deepEqual(firstManifest.pinnedAssets.apple, {
    type: "image",
    assetId: `sha256-${imageSha}`,
    sha256: imageSha,
    path: `/assets/library/images/apple.png`
  });
  assert.deepEqual(firstManifest.pinnedAssets.question1, {
    type: "audio",
    assetId: `sha256-${audioSha}`,
    sha256: audioSha,
    path: `/assets/library/audio/question1.mp3`
  });

  const secondManifest = JSON.parse(readFileSync(join(secondVersion, "assets.json"), "utf8"));
  assert.equal(secondManifest.categories, undefined);
  assert.equal(secondManifest.shared, undefined);
  assert.deepEqual(secondManifest.pinnedAssets.apple, firstManifest.pinnedAssets.apple);
});

function assetManifest(gameId, images, audio) {
  return {
    version: "2.0.0",
    baseUrl: "assets",
    categories: {},
    shared: {},
    games: {
      [gameId]: {
        manifest: { images, audio, spritesheets: [] }
      }
    }
  };
}

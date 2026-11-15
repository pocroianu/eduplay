import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { importActivityPackage } from "../import-activity-package.mjs";

function createPackageFixture() {
  const repoRoot = mkdtempSync(join(tmpdir(), "activity-import-repo-"));
  const packageRoot = mkdtempSync(join(tmpdir(), "activity-package-"));
  const image = Buffer.from("image-bytes");
  const sha256 = createHash("sha256").update(image).digest("hex");
  const bananaImage = Buffer.from("banana-image-bytes");
  const bananaSha256 = createHash("sha256").update(bananaImage).digest("hex");

  mkdirSync(join(packageRoot, "versions", "1", "strings"), { recursive: true });
  mkdirSync(join(packageRoot, "assets", "library", "images"), { recursive: true });
  writeFileSync(join(packageRoot, "activity.json"), JSON.stringify({
    activityId: "generated-fruits-01",
    version: 1,
    renderer: { id: "multiple-choice", version: "^1.0.0" },
    gameId: "generated-fruits-01"
  }));
  writeFileSync(join(packageRoot, "versions", "1", "config.json"), JSON.stringify({
    meta: {
      gameId: "generated-fruits-01",
      version: "1.0.0",
      gameType: "multipleChoice",
      totalSteps: 1,
      supportedLanguages: ["en"]
    },
    questions: [{
      id: "q1",
      questionKey: "q1.question",
      choices: [
        { type: "image", value: "apple", isCorrect: true },
        { type: "image", value: "banana", isCorrect: false }
      ]
    }]
  }));
  writeFileSync(join(packageRoot, "versions", "1", "strings", "en.json"), JSON.stringify({ meta: { title: "Generated" } }));
  writeFileSync(join(packageRoot, "assets", "library", "images", "apple.png"), image);
  writeFileSync(join(packageRoot, "assets", "library", "images", "banana.png"), bananaImage);
  writeFileSync(join(packageRoot, "versions", "1", "assets.json"), JSON.stringify({
    version: "2.0.0",
    baseUrl: "/assets/library",
    pinnedAssets: {
      apple: {
        type: "image",
        assetId: `sha256-${sha256}`,
        sha256,
        path: "/assets/library/images/apple.png"
      },
      banana: {
        type: "image",
        assetId: `sha256-${bananaSha256}`,
        sha256: bananaSha256,
        path: "/assets/library/images/banana.png"
      }
    },
    games: {
      "generated-fruits-01": {
        manifest: { images: ["apple", "banana"], audio: [], spritesheets: [] }
      }
    }
  }));

  return { packageRoot, repoRoot };
}

test("imports a reviewable Activity package into repo activities and asset library", () => {
  const { packageRoot, repoRoot } = createPackageFixture();
  const result = importActivityPackage({ packageRoot, repoRoot });

  assert.equal(result.activityId, "generated-fruits-01");
  assert.equal(result.version, 1);
  assert.equal(existsSync(join(repoRoot, "activities", "generated-fruits-01", "activity.json")), true);
  assert.equal(existsSync(join(repoRoot, "activities", "generated-fruits-01", "versions", "1", "config.json")), true);
  assert.equal(existsSync(join(repoRoot, "assets", "library", "images", "apple.png")), true);
  assert.deepEqual(JSON.parse(readFileSync(join(repoRoot, "activities", "generated-fruits-01", "versions", "1", "assets.json"), "utf8")).games["generated-fruits-01"].manifest.images, ["apple", "banana"]);
});


test("a missing later pin leaves the library and existing metadata unchanged", (t) => {
  const { packageRoot, repoRoot } = createPackageFixture();
  t.after(() => { rmSync(packageRoot, { recursive: true, force: true }); rmSync(repoRoot, { recursive: true, force: true }); });
  rmSync(join(packageRoot, "assets/library/images/banana.png"));
  assert.throws(() => importActivityPackage({ packageRoot, repoRoot }), /banana.png/);
  assert.equal(existsSync(join(repoRoot, "assets/library/images/apple.png")), false);
  assert.equal(existsSync(join(repoRoot, "activities/generated-fruits-01/activity.json")), false);
});

test("publication failure restores an overwritten library asset", (t) => {
  const { packageRoot, repoRoot } = createPackageFixture();
  t.after(() => { rmSync(packageRoot, { recursive: true, force: true }); rmSync(repoRoot, { recursive: true, force: true }); });
  mkdirSync(join(repoRoot, "assets/library/images"), { recursive: true });
  const apple = join(repoRoot, "assets/library/images/apple.png");
  writeFileSync(apple, "published-original");
  // This obstructs publication only after the staged library writes are applied.
  mkdirSync(join(repoRoot, "activities/generated-fruits-01"), { recursive: true });
  writeFileSync(join(repoRoot, "activities/generated-fruits-01/versions"), "blocked");
  assert.throws(() => importActivityPackage({ packageRoot, repoRoot, overwrite: true }));
  assert.equal(readFileSync(apple, "utf8"), "published-original");
  assert.equal(existsSync(join(repoRoot, "assets/library/images/banana.png")), false);
  assert.equal(readdirSync(repoRoot).some(name => name.startsWith(".activity-import-")), false);
});

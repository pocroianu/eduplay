import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { importActivityPackage } from "../import-activity-package.mjs";

test("rejects Activity packages with invalid game config before writing", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "activity-import-repo-"));
  const packageRoot = mkdtempSync(join(tmpdir(), "activity-package-invalid-config-"));

  mkdirSync(join(packageRoot, "versions", "1", "strings"), { recursive: true });
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
    questions: [{ id: "q1", questionKey: "q1.question", choices: [] }]
  }));
  writeFileSync(join(packageRoot, "versions", "1", "strings", "en.json"), JSON.stringify({ meta: { title: "Generated" } }));
  writeFileSync(join(packageRoot, "versions", "1", "assets.json"), JSON.stringify({
    version: "2.0.0",
    baseUrl: "/assets/library",
    pinnedAssets: {},
    games: {
      "generated-fruits-01": { manifest: { images: [], audio: [], spritesheets: [] } }
    }
  }));

  assert.throws(() => importActivityPackage({ packageRoot, repoRoot }), /Invalid Activity package config/);
  assert.equal(existsSync(join(repoRoot, "activities", "generated-fruits-01")), false);
});

test("rejects Activity package IDs that would escape the repo activities directory", () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "activity-import-repo-"));
  const packageRoot = mkdtempSync(join(tmpdir(), "activity-package-bad-id-"));

  mkdirSync(join(packageRoot, "versions", "1", "strings"), { recursive: true });
  writeFileSync(join(packageRoot, "activity.json"), JSON.stringify({
    activityId: "../escape",
    version: 1,
    renderer: { id: "multiple-choice", version: "^1.0.0" },
    gameId: "../escape"
  }));
  writeFileSync(join(packageRoot, "versions", "1", "config.json"), JSON.stringify({}));
  writeFileSync(join(packageRoot, "versions", "1", "assets.json"), JSON.stringify({
    version: "2.0.0",
    baseUrl: "/assets/library",
    pinnedAssets: {},
    games: {
      "../escape": { manifest: { images: [], audio: [], spritesheets: [] } }
    }
  }));

  assert.throws(() => importActivityPackage({ packageRoot, repoRoot }), /Invalid Activity package activityId/);
});

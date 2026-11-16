import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createRequire } from "node:module";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tsNode = createRequire(import.meta.url).resolve("ts-node/dist/bin.js");

test("validate-all-configs reports selected-game missing asset pins", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "validate-all-configs-pins-"));
  const activityRoot = join(fixtureRoot, "activities", "broken-pins");
  const versionRoot = join(activityRoot, "versions", "1");
  mkdirSync(join(versionRoot, "strings"), { recursive: true });

  writeFileSync(join(activityRoot, "activity.json"), JSON.stringify({
    activityId: "broken-pins",
    version: 1,
    renderer: { id: "multiple-choice", version: "^1.0.0" },
    gameId: "broken-pins"
  }));
  writeFileSync(join(versionRoot, "config.json"), JSON.stringify({
    meta: {
      gameId: "broken-pins",
      gameType: "multipleChoice",
      version: "1.0.0",
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
  writeFileSync(join(versionRoot, "strings", "en.json"), JSON.stringify({
    meta: { title: "Broken pins" },
    questions: { q1: { question: "Pick apple" } },
    choices: { apple: "Apple", banana: "Banana" }
  }));
  writeFileSync(join(versionRoot, "assets.json"), JSON.stringify({
    version: "2.0.0",
    baseUrl: "assets",
    pinnedAssets: {},
    games: {
      "broken-pins": {
        manifest: { images: ["apple"], audio: [], spritesheets: [] }
      }
    }
  }));

  const result = spawnSync(process.execPath, [tsNode, resolve(repoRoot, "scripts/validate-all-configs.ts"), "--root", fixtureRoot], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0, output);
  assert.match(output, /Activity asset manifests/);
  assert.match(output, /broken-pins[\\/]versions[\\/]1[\\/]assets\.json/);
  assert.match(output, /games\.broken-pins\.manifest\.images\.apple is missing an image pin/);
});

test("validate-all-configs reports invalid Activity config JSON without crashing", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "validate-all-configs-"));
  const versionRoot = join(fixtureRoot, "activities", "broken-activity", "versions", "1");
  mkdirSync(join(versionRoot, "strings"), { recursive: true });

  writeFileSync(join(fixtureRoot, "activities", "broken-activity", "activity.json"), JSON.stringify({
    activityId: "broken-activity",
    version: 1,
    renderer: { id: "multiple-choice", version: "^1.0.0" },
    gameId: "broken-activity"
  }));
  writeFileSync(join(versionRoot, "config.json"), "{");
  writeFileSync(join(versionRoot, "assets.json"), JSON.stringify({
    version: "2.0.0",
    baseUrl: "assets",
    categories: {},
    shared: {},
    games: {
      "broken-activity": {
        manifest: { images: [], audio: [] }
      }
    }
  }));

  const result = spawnSync(process.execPath, [tsNode, resolve(repoRoot, "scripts/validate-all-configs.ts"), "--root", fixtureRoot], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0, output);
  assert.match(output, /Activity game configs/);
  assert.match(output, /broken-activity[\\/]versions[\\/]1[\\/]config\.json/);
  assert.match(output, /VALIDATION SUMMARY/);
  assert.doesNotMatch(output, /SyntaxError:|at JSON\.parse/);
});


test("validate-all-configs rejects an invalid older version while the selected version is valid", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "validate-old-version-"));
  const activityRoot = join(fixtureRoot, "activities/older-invalid");
  mkdirSync(activityRoot, { recursive: true });
  writeFileSync(join(activityRoot, "activity.json"), JSON.stringify({
    activityId: "older-invalid", version: 2, renderer: { id: "multiple-choice", version: "^1.0.0" }, gameId: "older-invalid"
  }));
  for (const version of [1, 2]) {
    const root = join(activityRoot, "versions", String(version));
    mkdirSync(join(root, "strings"), { recursive: true });
    writeFileSync(join(root, "config.json"), JSON.stringify(version === 1 ? {} : {
      meta: { gameId: "older-invalid", gameType: "multipleChoice", version: "1.0.0", totalSteps: 1, supportedLanguages: ["en"] },
      questions: [{ id: "q1", questionKey: "q1", choices: [
        { type: "image", value: "a", isCorrect: true }, { type: "image", value: "b", isCorrect: false }
      ] }]
    }));
    writeFileSync(join(root, "strings/en.json"), JSON.stringify({ meta: { title: "Fixture" } }));
    writeFileSync(join(root, "assets.json"), JSON.stringify({
      version: "2.0.0", baseUrl: "/assets/library", pinnedAssets: {},
      games: { "older-invalid": { manifest: { images: [], audio: [], spritesheets: [] } } }
    }));
  }
  const result = spawnSync(process.execPath, [
    tsNode, resolve(repoRoot, "scripts/validate-all-configs.ts"), "--root", fixtureRoot
  ], { cwd: repoRoot, encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /older-invalid[\\/]versions[\\/]1[\\/]config.json/);
  assert.match(result.stdout, /PASS.*versions[\\/]2[\\/]config.json/);
});

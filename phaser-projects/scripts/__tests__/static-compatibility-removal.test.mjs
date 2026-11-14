import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("legacy template static compatibility content is not checked in", () => {
  const legacyPaths = [];
  const templatesRoot = join(repoRoot, "templates");

  if (existsSync(templatesRoot)) {
    for (const entry of readdirSync(templatesRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      for (const legacyName of ["static", "asset-registry.json"]) {
        const legacyPath = join(templatesRoot, entry.name, legacyName);
        if (existsSync(legacyPath)) legacyPaths.push(relativeRepoPath(legacyPath));
      }
    }
  }

  const legacyRegistry = join(repoRoot, "packages/game-core/templates/registry.json");
  if (existsSync(legacyRegistry)) legacyPaths.push(relativeRepoPath(legacyRegistry));

  assert.deepEqual(legacyPaths, []);
});

test("runtime and tooling source do not reference the legacy static layout", () => {
  const scannedFiles = [
    join(repoRoot, ".vscode/settings.json"),
    join(repoRoot, "Jenkinsfile"),
    ...collectFiles(join(repoRoot, "packages"), new Set([".ts", ".tsx", ".js", ".mjs", ".json"]), ["__tests__", "node_modules", "dist"]),
    ...collectFiles(join(repoRoot, "renderers"), new Set([".ts", ".tsx", ".js", ".mjs", ".json"]), ["__tests__", "node_modules", "dist"]),
    ...collectFiles(join(repoRoot, "scripts"), new Set([".ts", ".tsx", ".js", ".mjs", ".json"]), ["__tests__", "node_modules", "dist"]),
    ...collectFiles(join(repoRoot, "tools"), new Set([".ts", ".tsx", ".js", ".mjs", ".json"]), ["__tests__", "node_modules", "dist"]),
    ...collectFiles(join(repoRoot, "e2e"), new Set([".ts", ".js", ".mjs"]), ["node_modules", "test-results", "playwright-report"]),
  ].filter(existsSync);

  const legacyPattern = /templates[\\/].*static|static[\\/]configs|configs[\\/]games|asset-registry\.json/;

  const offenders = [];
  for (const filePath of scannedFiles) {
    const content = readFileSync(filePath, "utf8");
    if (legacyPattern.test(content)) {
      offenders.push(relativeRepoPath(filePath));
    }
  }

  assert.deepEqual(offenders, []);
});

function collectFiles(root, extensions, ignoredDirectories) {
  if (!existsSync(root)) return [];

  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.includes(entry.name)) {
        files.push(...collectFiles(entryPath, extensions, ignoredDirectories));
      }
    } else if (extensions.has(extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function relativeRepoPath(filePath) {
  return filePath.slice(repoRoot.length + 1).replace(/\\/g, "/");
}

import assert from "node:assert/strict";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(packageDir, "../..");
const packageJson = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));

test("config-editor is served and built by Vite instead of webpack", () => {
  assert.equal(packageJson.scripts.start, "vite --host 0.0.0.0 --port 8091");
  assert.equal(packageJson.scripts.build, "vite build");
  assert.ok(existsSync(join(packageDir, "vite.config.ts")), "expected a Vite config");
  assert.equal(existsSync(join(packageDir, "webpack.config.js")), false, "webpack config should be removed");

  const devDependencies = packageJson.devDependencies ?? {};
  for (const removedPackage of [
    "clean-webpack-plugin",
    "copy-webpack-plugin",
    "html-webpack-plugin",
    "ts-loader",
    "webpack",
    "webpack-cli",
    "webpack-dev-server"
  ]) {
    assert.equal(devDependencies[removedPackage], undefined, `${removedPackage} should not be a config-editor dependency`);
  }
});

test("config-editor HTML is a Vite entrypoint", () => {
  const html = readFileSync(join(packageDir, "src/index.html"), "utf8");
  assert.match(html, /<script\s+type="module"\s+src="\.\/index\.ts"><\/script>/);
});

test("Vite production build emits the editor app and Activity-version content without the legacy template registry", () => {
  const legacyRegistryPath = join(repoRoot, "packages/game-core/templates/registry.json");
  const hiddenRegistryPath = join(repoRoot, "packages/game-core/templates/registry.json.test-hidden");
  let registryHidden = false;

  try {
    if (existsSync(legacyRegistryPath)) {
      renameSync(legacyRegistryPath, hiddenRegistryPath);
      registryHidden = true;
    }

    const result = spawnSync("npm run build", {
      cwd: packageDir,
      encoding: "utf8",
      shell: true
    });

    assert.equal(result.status, 0, `${result.error?.message ?? ""}\n${result.stdout}\n${result.stderr}`);
  } finally {
    if (registryHidden) {
      renameSync(hiddenRegistryPath, legacyRegistryPath);
    }
  }
  assert.ok(existsSync(join(packageDir, "dist/index.html")), "expected dist/index.html");
  assert.ok(existsSync(join(packageDir, "dist/styles.css")), "expected copied editor stylesheet");
  assert.ok(existsSync(join(packageDir, "dist/editor-catalogs/multiple-choice.json")), "expected generated editor catalog");
  assert.ok(existsSync(join(packageDir, "dist/activities/fruits-01/versions/1/config.json")), "expected Activity version config");
  assert.ok(existsSync(join(packageDir, "dist/activities/fruits-01/versions/1/assets.json")), "expected Activity version assets manifest");
  assert.ok(
    existsSync(join(packageDir, "dist/assets/library/images/apple.png")),
    "expected shared semantic asset library blob"
  );
  assert.ok(
    existsSync(join(packageDir, "dist/assets/shared/mascots/guapen.png")),
    "expected shared boot mascot asset"
  );
  assert.equal(existsSync(join(packageDir, "dist/templates")), false, "config-editor should not package template static compatibility content");
});

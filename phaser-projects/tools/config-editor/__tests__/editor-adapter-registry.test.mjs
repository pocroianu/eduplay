import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const renderersRoot = join(repoRoot, "renderers");

test("config-editor adapter ids match renderer metadata ids", () => {
  const mismatches = [];

  for (const entry of readdirSync(renderersRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const rendererPath = join(renderersRoot, entry.name, "renderer.json");
    const editorAdapterPath = join(renderersRoot, entry.name, "src", "editorAdapter.ts");
    if (!existsSync(rendererPath) || !existsSync(editorAdapterPath)) continue;

    const renderer = JSON.parse(readFileSync(rendererPath, "utf8"));
    const adapterSource = readFileSync(editorAdapterPath, "utf8");
    const idMatch = adapterSource.match(/\bid:\s*["']([^"']+)["']/);
    const adapterId = idMatch?.[1];

    if (adapterId !== renderer.rendererId) {
      mismatches.push(`${entry.name}: rendererId=${renderer.rendererId}, adapterId=${adapterId ?? "<missing>"}`);
    }
  }

  assert.deepEqual(mismatches, []);
});

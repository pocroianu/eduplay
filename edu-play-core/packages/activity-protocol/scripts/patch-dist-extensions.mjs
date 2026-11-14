import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const replacements = [
  ["'./messages'", "'./messages.js'"],
  ["'./origin'", "'./origin.js'"],
];

for (const relativePath of ['dist/index.js', 'dist/index.d.ts']) {
  const path = join(packageRoot, relativePath);
  let source = await readFile(path, 'utf8');

  for (const [from, to] of replacements) {
    source = source.replaceAll(from, to);
  }

  await writeFile(path, source);
}

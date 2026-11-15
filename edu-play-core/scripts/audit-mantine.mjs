import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceRoot = path.join(projectRoot, "src");
const excluded =
  /(?:\.test\.|\.spec\.|\.stories\.|\.d\.ts$|[/\\]test-utils[/\\]|[/\\]seesaw-design-system[/\\])/;
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (excluded.test(filename)) continue;
    if (entry.isDirectory()) walk(filename);
    else if (/\.tsx?$/.test(filename)) files.push(filename);
  }
}
walk(sourceRoot);

const sources = new Map(
  files.map((filename) => [
    filename,
    ts.createSourceFile(
      filename,
      fs.readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    ),
  ]),
);
const relative = (filename) =>
  path.relative(sourceRoot, filename).split(path.sep).join("/");
function resolveModule(from, specifier) {
  const base = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : undefined;
  if (!base) return undefined;
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ].find((candidate) => sources.has(candidate));
}

// Follow the imported symbol through barrels, rather than treating every kit
// consumer as if it used every component exported by the kit.
function exportTargets(filename, name, visited = new Set()) {
  const key = `${filename}:${name}`;
  if (visited.has(key)) return [];
  visited.add(key);
  const source = sources.get(filename);
  const matches = [];
  let hasLocalExport = false;
  for (const node of source.statements) {
    if (!ts.isExportDeclaration(node)) {
      if (
        node.modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        )
      ) {
        if (
          node.name?.text === name ||
          (name === "default" &&
            node.modifiers.some(
              (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
            ))
        )
          hasLocalExport = true;
        if (
          ts.isVariableStatement(node) &&
          node.declarationList.declarations.some(
            (declaration) => declaration.name.getText(source) === name,
          )
        )
          hasLocalExport = true;
      }
      continue;
    }
    if (node.isTypeOnly) continue;
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) {
      if (
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.some(
          (element) => element.name.text === name && !element.isTypeOnly,
        )
      )
        hasLocalExport = true;
      continue;
    }
    const target = resolveModule(filename, node.moduleSpecifier.text);
    if (!target) continue;
    if (!node.exportClause)
      matches.push(...exportTargets(target, name, new Set(visited)));
    else if (ts.isNamedExports(node.exportClause)) {
      for (const element of node.exportClause.elements) {
        if (element.name.text === name && !element.isTypeOnly)
          matches.push(
            ...exportTargets(
              target,
              element.propertyName?.text ?? name,
              new Set(visited),
            ),
          );
      }
    }
  }
  return hasLocalExport ? [filename] : matches;
}

const direct = new Set();
const dependencies = new Map();
const packages = new Map();
const rawControls = [];
for (const [filename, source] of sources) {
  const edges = new Set();
  for (const node of source.statements) {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier) ||
      node.importClause?.isTypeOnly
    )
      continue;
    const specifier = node.moduleSpecifier.text;
    if (specifier.startsWith("@mantine/")) {
      const bindings = node.importClause?.namedBindings;
      if (
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.every((element) => element.isTypeOnly)
      )
        continue;
      direct.add(filename);
      if (!packages.has(specifier)) packages.set(specifier, new Set());
      packages.get(specifier).add(relative(filename));
    }
    const target = resolveModule(filename, specifier);
    if (!target) continue;
    const bindings = node.importClause?.namedBindings;
    if (node.importClause?.name) edges.add(target);
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (!element.isTypeOnly)
          for (const dependency of exportTargets(
            target,
            element.propertyName?.text ?? element.name.text,
          ))
            edges.add(dependency);
      }
    } else if (bindings) edges.add(target);
  }
  dependencies.set(filename, edges);
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      if (
        [
          "button",
          "motion.button",
          "input",
          "select",
          "textarea",
          "dialog",
          "table",
        ].includes(tag)
      ) {
        const hidden =
          tag === "input" &&
          node.attributes.properties.some(
            (attribute) =>
              ts.isJsxAttribute(attribute) &&
              attribute.name.text === "type" &&
              attribute.initializer &&
              ts.isStringLiteral(attribute.initializer) &&
              attribute.initializer.text === "hidden",
          );
        if (!hidden)
          rawControls.push({
            file: relative(filename),
            line:
              source.getLineAndCharacterOfPosition(node.getStart(source)).line +
              1,
            tag,
          });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

function usesMantine(filename, visited = new Set()) {
  if (direct.has(filename)) return true;
  if (visited.has(filename)) return false;
  visited.add(filename);
  return [...(dependencies.get(filename) ?? [])].some((dependency) =>
    usesMantine(dependency, visited),
  );
}
const tsxFiles = files.filter((filename) => filename.endsWith(".tsx"));
const areaRows = new Map();
for (const filename of tsxFiles) {
  const name = relative(filename);
  const area = name.startsWith("features/")
    ? name.split("/").slice(0, 2).join("/")
    : name.startsWith("shared/components/ui/kit/")
      ? "shared UI kit"
      : name.startsWith("app/")
        ? "app routes"
        : "other";
  if (!areaRows.has(area))
    areaRows.set(area, { files: 0, direct: 0, indirect: 0 });
  const row = areaRows.get(area);
  row.files++;
  if (direct.has(filename)) row.direct++;
  else if (usesMantine(filename)) row.indirect++;
}
const directTsx = tsxFiles.filter((filename) => direct.has(filename)).length;
const indirectTsx = tsxFiles.filter(
  (filename) => !direct.has(filename) && usesMantine(filename),
).length;
console.log(
  JSON.stringify(
    {
      scope:
        "src production TS/TSX; tests, stories, declarations, test helpers and archived prototypes excluded",
      methodology:
        "Static imports and local runtime dependencies, resolving named barrel exports; indirect means a file depends on Mantine-backed code, not that every element it renders is Mantine. Not a bundle-size or runtime-visibility measure.",
      totals: {
        tsxFiles: tsxFiles.length,
        directTsx,
        indirectTsx,
        independentTsx: tsxFiles.length - directTsx - indirectTsx,
      },
      areas: Object.fromEntries(areaRows),
      packages: Object.fromEntries(
        [...packages].map(([name, consumers]) => [name, [...consumers].sort()]),
      ),
      kitWithoutMantineDependency: tsxFiles
        .filter(
          (filename) =>
            relative(filename).startsWith("shared/components/ui/kit/") &&
            !usesMantine(filename),
        )
        .map(relative),
      rawVisibleControls: rawControls,
    },
    null,
    2,
  ),
);

if (process.argv.includes("--check") && rawControls.length > 0) {
  process.exitCode = 1;
}

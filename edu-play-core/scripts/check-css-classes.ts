import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import postcss, { type AnyNode, type Root } from "postcss";
import tailwindPostcss from "@tailwindcss/postcss";
import ts from "typescript";

// These are component hooks, rather than Tailwind utilities.
const CSS_HOOK_PREFIXES = ["mantine-", "teacher-", "ep-progress-"];
// Classes used in code that never existed in any build (they silently do nothing today).
// Each needs its call site fixed or a token added; shrink this list, never grow it.
const ALLOWED_MISSING: Record<string, string> = {};
// Defined at runtime by Mantine, or scoped to a component; not expected in globals.css.
const RUNTIME_VAR_PREFIXES = ["--mantine-"];
// RingProgress sets this on each SVG curve at runtime.
const RUNTIME_VARS = new Set(["--curve-color"]);
// Theme tokens deliberately changed or removed since the baseline snapshot. Keep each reason; shrink, never grow.
const ALLOWED_TOKEN_CHANGES: Record<string, string> = {
  "--font-mono": "now leads with the next/font variable --font-jetbrains-mono (set on <html> at runtime, so unresolvable here)",
  "--default-mono-font-family": "follows --font-mono",
  "--color-tertiary": "legacy alias with no usages, removed",
};
function isRuntimeVar(name: string) { return RUNTIME_VARS.has(name) || RUNTIME_VAR_PREFIXES.some((prefix) => name.startsWith(prefix)); }
// `var(--x)` with no fallback is a failure when --x is undefined.
export function unresolvedVariables(source: string, definitions: Set<string>): string[] {
  return [...source.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)]
    .map((match) => match[1])
    .filter((name) => !definitions.has(name) && !isRuntimeVar(name));
}
// `var(--x, fallback)` with an undefined --x still renders; report it as a warning only.
export function unresolvedVariablesWithFallback(source: string, definitions: Set<string>): string[] {
  return [...source.matchAll(/var\(\s*(--[\w-]+)\s*,/g)]
    .map((match) => match[1])
    .filter((name) => !definitions.has(name) && !isRuntimeVar(name));
}
// Default Tailwind theme values: a dropped EduPlay token that equals its default is emitted on use, not lost.
function tailwindDefaultTokens(): Map<string, string> {
  const result = new Map<string, string>();
  const themePath = path.join(path.dirname(createRequire(import.meta.url).resolve("tailwindcss/package.json")), "theme.css");
  for (const match of fs.readFileSync(themePath, "utf8").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) result.set(match[1], match[2].replace(/\s+/g, " ").trim());
  return result;
}
export type DeclarationDiff = { kind: "cosmetic" | "token-aligned" | "real"; before: string; after: string };

// Whitespace, declaration order, terminal semicolons and zero-length units do
// not change the computed value. Keep all other syntax significant.
function normalizeDeclaration(value: string) {
  const separator = value.lastIndexOf(" | ");
  const context = separator < 0 ? "" : value.slice(0, separator + 3).replace(/\s+/g, " ");
  const declaration = value.slice(separator < 0 ? 0 : separator + 3);
  return context + declaration.trim().replace(/;$/, "").replace(/\s+/g, " ").replace(/\b0px\b/g, "0").replace(/\s*:\s*/, ": ");
}

function declarationSeparator(value: string) { return value.indexOf(": ", value.lastIndexOf(" | ") + 3); }

/**
 * Resolves a declaration value to the value the browser ends up with, so that
 * `calc(var(--spacing) * 5)` (with `--spacing: 4px`) equals `20px`, and
 * `var(--font-weight-bold)` equals `800`. `vars` maps custom properties defined
 * at :root in the compiled output.
 */
export function resolveValue(value: string, vars: Map<string, string>): string {
  let result = value;
  for (let depth = 0; depth < 12 && result.includes("var("); depth++) {
    result = result.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))*[^()]*))?\)/g, (match, name: string, fallback?: string) =>
      vars.get(name) ?? fallback?.trim() ?? match);
  }
  result = result
    .replace(/calc\(\s*infinity\s*\*\s*1px\s*\)/g, "999px")
    // Compare at the default 16px root size: the old build baked spacing into px, Tailwind's
    // default `--spacing: 0.25rem` yields the same size but also scales with the user's font size.
    .replace(/(-?[\d.]+)rem\b/g, (_, n: string) => `${+(Number(n) * 16).toFixed(4)}px`)
    .replace(/calc\(\s*(-?[\d.]+)px\s*\*\s*(-?[\d.]+)\s*\)/g, (_, a: string, b: string) => `${+(Number(a) * Number(b)).toFixed(4)}px`)
    .replace(/calc\(\s*(-?[\d.]+)\s*\*\s*(-?[\d.]+)px\s*\)/g, (_, a: string, b: string) => `${+(Number(a) * Number(b)).toFixed(4)}px`)
    // Tailwind's colour-space choice for opacity modifiers (oklab vs srgb fallback) is not a design change.
    .replace(/color-mix\(\s*in (?:oklab|srgb),/g, "color-mix(in *,")
    .replace(/#([\da-f]{3,8})\b/gi, (_, hex: string) => `#${hex.toLowerCase()}`)
    .replace(/\b0px\b/g, "0")
    .replace(/\s+/g, " ")
    .trim();
  return result;
}

let resolverVars: Map<string, string> | undefined;
let tokenValues: Set<string> | undefined;
/** Values of --color-*, --radius-* and --shadow-* tokens; an "after" value equal to one is the token winning. */
export function setResolverContext(vars: Map<string, string>) {
  resolverVars = vars;
  tokenValues = new Set(
    [...vars].filter(([name]) => /^--(color|radius|shadow)-/.test(name)).map(([, value]) => resolveValue(value, vars).replace(/var\(--tw-shadow-color,\s*([^)]*\))\)/g, "$1")),
  );
}
function stripShadowColor(value: string) { return value.replace(/var\(--tw-shadow-color,\s*(rgba?\([^)]*\)|#[\da-f]+)\)/gi, "$1"); }
// Tailwind emits a colour-mix enhancement inside this @supports block next to a resolved fallback.
const COLOR_MIX_SUPPORTS = "@supports (color: color-mix(in lab, red, red))";

export function classifyDeclarations(before: string[], after: string[]): DeclarationDiff[] {
  if (resolverVars) return classifyResolved(before, after, resolverVars);
  const remaining = after.map(normalizeDeclaration);
  const differences: DeclarationDiff[] = [];
  for (const original of before.map(normalizeDeclaration)) {
    const exact = remaining.indexOf(original);
    if (exact !== -1) { remaining.splice(exact, 1); continue; }
    const separator = declarationSeparator(original);
    const property = original.slice(0, separator);
    const index = remaining.findIndex((entry) => entry.slice(0, declarationSeparator(entry)) === property);
    const replacement = index < 0 ? "(missing)" : remaining.splice(index, 1)[0];
    const oldValue = original.slice(separator + 2);
    const newValue = replacement.slice(declarationSeparator(replacement) + 2);
    const colourProperty = /(?:^|\s)(?:color|background-color|border(?:-\w+)?-color|outline-color|fill|stroke|--tw-gradient-(?:from|via|to))$/.test(property);
    const literalColour = /^(?:#[\da-f]{3,8}|(?:rgb|rgba|oklch)\([^)]*\))$/i.test(oldValue);
    const tokenColour = /^(?:var\(--color-[\w-]+\)|color-mix\(.*var\(--color-[\w-]+\).*\))$/i.test(newValue);
    differences.push({ kind: colourProperty && literalColour && tokenColour ? "token-aligned" : "real", before: original, after: replacement });
  }
  for (const entry of remaining) differences.push({ kind: "real", before: "(missing)", after: entry });
  return differences;
}
function parseDeclaration(entry: string) {
  const separator = entry.lastIndexOf(" | ");
  const context = (separator < 0 ? "" : entry.slice(0, separator)).split(" > ").filter((part) => part && part !== COLOR_MIX_SUPPORTS).join(" > ").replace(/\s+/g, " ").trim();
  const declaration = (separator < 0 ? entry : entry.slice(separator + 3)).trim().replace(/;$/, "");
  const colon = declaration.indexOf(":");
  return { context, prop: declaration.slice(0, colon).trim(), value: declaration.slice(colon + 1).replace(/\s*!important$/, " !important").trim(), raw: entry };
}

function classifyResolved(before: string[], after: string[], vars: Map<string, string>): DeclarationDiff[] {
  const differences: DeclarationDiff[] = [];
  const supportsOnly = (entry: string) => entry.includes(COLOR_MIX_SUPPORTS);
  const remaining = after.map(parseDeclaration);
  const supportsEntries = new Set(after.filter(supportsOnly).map((entry) => parseDeclaration(entry)));
  for (const original of before.map(parseDeclaration)) {
    const sameSlot = (entry: ReturnType<typeof parseDeclaration>) => entry.context === original.context && entry.prop === original.prop;
    // Prefer the plain (fallback) declaration over the @supports enhancement when both exist.
    let index = remaining.findIndex((entry) => sameSlot(entry) && !supportsOnly(entry.raw));
    if (index < 0) index = remaining.findIndex(sameSlot);
    if (index < 0) { differences.push({ kind: "real", before: original.raw, after: "(missing)" }); continue; }
    const replacement = remaining.splice(index, 1)[0];
    const oldValue = resolveValue(original.value, vars), newValue = resolveValue(replacement.value, vars);
    if (oldValue === newValue) { differences.push({ kind: "cosmetic", before: original.raw, after: replacement.raw }); continue; }
    const tokenised = stripShadowColor(newValue);
    const mixed = /color-mix\(in \*, ([^ ]+) /.exec(newValue)?.[1];
    const tokenBacked = tokenValues?.has(tokenised) || (mixed !== undefined && tokenValues?.has(mixed)) || /var\(--(color|radius|shadow)-/.test(replacement.value)
      || tokenised.split(/,(?![^(]*\))/).every((part) => tokenValues?.has(part.trim()));
    differences.push({ kind: tokenBacked ? "token-aligned" : "real", before: `${original.raw}  [= ${oldValue}]`, after: `${replacement.raw}  [= ${newValue}]` });
  }
  for (const entry of remaining) {
    // Tailwind's progressive colour-mix enhancement and its matching fallback are paired output, not new styling.
    if (supportsEntries.has(entry) || supportsOnly(entry.raw)) { differences.push({ kind: "cosmetic", before: "(missing)", after: entry.raw }); continue; }
    differences.push({ kind: "real", before: "(missing)", after: entry.raw });
  }
  return differences;
}

const src = path.resolve("src");
const cssPath = path.resolve("src/app/globals.css");
const beforePath = path.resolve("scripts/.tmp/globals.compiled.before.css");
const afterPath = path.resolve("scripts/.tmp/globals.compiled.after.css");

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : [name];
  });
}

const sourceFiles = files(src);
const used = new Set<string>();
function add(value: string) {
  for (const token of value.split(/\s+/)) {
    if (!token || /["'`{}$]/.test(token) || !/[-:]/.test(token)) continue;
    if (CSS_HOOK_PREFIXES.some((prefix) => token.startsWith(prefix))) continue;
    used.add(token);
  }
}
function literals(node: ts.Node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text);
  else if (ts.isTemplateExpression(node)) {
    add(node.head.text);
    for (const span of node.templateSpans) add(span.literal.text);
  } else ts.forEachChild(node, literals);
}
for (const file of sourceFiles.filter((name) => /\.tsx?$/.test(name) && !/\.test\.[^.]+$/.test(name) && !name.split(path.sep).includes("__tests__"))) {
  const tree = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && node.name.getText(tree) === "className" && node.initializer) literals(node.initializer);
    if (ts.isCallExpression(node) && /^(cn|clsx)$/.test(node.expression.getText(tree))) for (const arg of node.arguments) literals(arg);
    if (ts.isPropertyAssignment(node) && /Class(?:Name)?$/.test(node.name.getText(tree).replace(/["']/g, ""))) literals(node.initializer);
    ts.forEachChild(node, visit);
  }
  visit(tree);
}

function escaped(token: string) { return `.${token.replace(/[^A-Za-z0-9_-]/g, "\\$&")}`; }
function rules(root: Root, token: string): string[] {
  const selector = escaped(token);
  const result: string[] = [];
  root.walkRules((rule) => {
    const index = rule.selector.indexOf(selector);
    // A word/escape character right before the match means the class sits inside a compound
    // selector of another utility (e.g. `[&_button.text-coral-deep]:hover:bg-x` → `& button.text-coral-deep`).
    if (index < 0 || /[A-Za-z0-9_\\-]/.test(rule.selector[index - 1] ?? "") || /[A-Za-z0-9_\\-]/.test(rule.selector[index + selector.length] ?? "")) return;
    rule.walkDecls((decl) => {
      const context: string[] = [];
      for (let parent: AnyNode | undefined = decl.parent; parent; parent = parent.parent) {
        if (parent.type === "atrule" && /^(media|supports|container)$/.test(parent.name)) context.unshift(`@${parent.name} ${parent.params}`);
        if (parent.type === "rule" && parent !== rule) context.unshift(parent.selector);
      }
      result.push(`${context.join(" > ")} | ${decl.toString().replace(/\s+/g, " ").trim()}`);
    });
  });
  return result.sort();
}

async function main() {
  const output = await postcss([tailwindPostcss()]).process(fs.readFileSync(cssPath, "utf8"), { from: cssPath });
  fs.mkdirSync(path.dirname(afterPath), { recursive: true });
  fs.writeFileSync(afterPath, output.css);
  const after = postcss.parse(output.css);
  const before = fs.existsSync(beforePath) ? postcss.parse(fs.readFileSync(beforePath, "utf8")) : undefined;
  const rootVars = new Map<string, string>();
  after.walkRules((rule) => {
    if (!rule.selectors.some((selector) => selector === ":root" || selector === ":host")) return;
    rule.walkDecls(/^--/, (decl) => { rootVars.set(decl.prop, decl.value.replace(/\s+/g, " ").trim()); });
  });
  setResolverContext(rootVars);
  let missing = 0, diffs = 0, tokenDiffs = 0, aligned = 0;
  const alignedDetails: string[] = [];
  if (before) {
    const tokens = (root: Root) => {
      const result = new Map<string, string>();
      root.walkAtRules("layer", (layer) => {
        if (layer.params !== "theme") return;
        layer.walkRules((rule) => {
          if (!rule.selectors.includes(":root")) return;
          rule.walkDecls(/^--/, (decl) => { result.set(decl.prop, decl.value.replace(/\s+/g, " ").trim()); });
        });
      });
      return result;
    };
    const originalTokens = tokens(before), actualTokens = tokens(after);
    const defaults = tailwindDefaultTokens();
    for (const [name, value] of originalTokens) {
      if (ALLOWED_TOKEN_CHANGES[name]) continue;
      if (actualTokens.get(name) === undefined && defaults.get(name) === value) continue;
      if (actualTokens.get(name) === undefined || resolveValue(actualTokens.get(name)!, actualTokens) !== resolveValue(value, originalTokens)) {
        console.log(`TOKEN DIFF ${name}: before: ${value}; after: ${actualTokens.get(name) ?? "missing"}`);
        tokenDiffs++;
      }
    }
    console.log(`Theme tokens: ${originalTokens.size}; differences: ${tokenDiffs}`);
  }
  for (const token of [...used].sort()) {
    const actual = rules(after, token);
    if (!actual.length && !ALLOWED_MISSING[token]) { console.log(`MISSING ${token}`); missing++; }
    if (before && actual.length) {
      const previous = rules(before, token);
      if (previous.length) for (const difference of classifyDeclarations(previous, actual)) {
        if (difference.kind === "token-aligned") { aligned++; alignedDetails.push(`TOKEN-ALIGNED ${token}: ${difference.before} → ${difference.after}`); }
        else if (difference.kind === "real") { console.log(`DIFF ${token}\n  before: ${difference.before}\n  after:  ${difference.after}`); diffs++; }
      }
    }
  }
  const definitions = new Set<string>();
  for (const file of sourceFiles.filter((name) => name.endsWith(".css"))) for (const match of fs.readFileSync(file, "utf8").matchAll(/(--[\w-]+)\s*:/g)) definitions.add(match[1]);
  for (const file of sourceFiles.filter((name) => /\.tsx?$/.test(name) && !/\.test\.[jt]sx?$/.test(name))) for (const match of fs.readFileSync(file, "utf8").matchAll(/["'](--[\w-]+)["']\s*:/g)) definitions.add(match[1]);
  for (const match of output.css.matchAll(/(--[\w-]+)\s*:/g)) definitions.add(match[1]);
  for (const match of fs.readFileSync(path.join(src, "app/fonts.ts"), "utf8").matchAll(/variable:\s*["'](--[\w-]+)/g)) definitions.add(match[1]);
  const undefinedVars = new Set<string>();
  // Fallback-bearing variables are optional; test assertions and interpolated
  // variable names are not CSS declarations and must not create false positives.
  for (const file of sourceFiles.filter((name) => /\.(css|tsx?)$/.test(name) && !/\.test\.[jt]sx?$/.test(name))) for (const name of unresolvedVariables(fs.readFileSync(file, "utf8"), definitions)) undefinedVars.add(name);
  const fallbackVars = new Set<string>();
  for (const file of sourceFiles.filter((name) => /\.(css|tsx?)$/.test(name) && !/\.test\.[jt]sx?$/.test(name))) for (const name of unresolvedVariablesWithFallback(fs.readFileSync(file, "utf8"), definitions)) fallbackVars.add(name);
  if (fallbackVars.size) console.warn(`WARNING undefined variables (fallback present, not failing): ${[...fallbackVars].sort().join(", ")}`);
  console.log(`Undefined variables: ${[...undefinedVars].sort().join(", ") || "none"}`);
  console.log(alignedDetails.join("\n"));
  console.log(`Classes: ${used.size}; missing: ${missing}; token-aligned: ${aligned}; real declaration diffs: ${diffs}`);
  if (missing || diffs || tokenDiffs || undefinedVars.size) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve("scripts/check-css-classes.ts")) {
  main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}

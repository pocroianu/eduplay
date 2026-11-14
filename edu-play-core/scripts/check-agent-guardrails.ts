import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type FileSnapshot = {
  path: string;
  content: string;
  changedLines?: ReadonlySet<number>;
  status?: ChangedPathStatus;
};

export type GuardrailViolation = {
  rule: string;
  path: string;
  line: number;
  message: string;
};

export type ChangedPathStatus = 'A' | 'C' | 'M' | 'R' | 'D';

export type ChangedEntry = {
  path: string;
  status: ChangedPathStatus;
  changedLines: ReadonlySet<number>;
};

type CheckOptions = {
  fileExists?: (filePath: string) => boolean;
};

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SQL_EXTENSIONS = new Set(['.sql']);
const STATIC_GAME_EXTENSIONS = new Set(['.html', '.js', '.mjs']);

const API_RAW_JSON_RULE = 'api-no-raw-request-json';
const API_RAW_NEXT_RESPONSE_RULE = 'api-no-raw-nextresponse-json';
const CLIENT_CONSOLE_LOG_RULE = 'client-no-console-log';
const DEEP_IMPORT_RULE = 'feature-no-deep-imports';
const POSTMESSAGE_RULE = 'postmessage-no-wildcard-origin';
const RLS_NULL_SELECT_RULE = 'rls-no-null-select-visibility';
const ROUTE_BOUNDARY_RULE = 'route-requires-loading-and-error';
const UI_LOCALE_FORMATTING_RULE = 'ui-no-direct-locale-formatting';
const RAW_UI_TOKEN_RULE = 'ui-no-raw-token-values';
const UI_SCALE_HOVER_RULE = 'ui-no-scale-hover';

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function isSqlFile(filePath: string): boolean {
  return SQL_EXTENSIONS.has(path.extname(filePath));
}

function isStaticGameFile(filePath: string): boolean {
  return filePath.startsWith('public/games/') && STATIC_GAME_EXTENSIONS.has(path.extname(filePath));
}

function isTestFile(filePath: string): boolean {
  return (
    filePath.startsWith('tests/') ||
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    filePath.includes('/__tests__/')
  );
}

function lineNumberForIndex(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function lineNumberForLine(lines: string[], lineIndex: number): number {
  return lineIndex + 1;
}

function addViolation(
  violations: GuardrailViolation[],
  rule: string,
  filePath: string,
  line: number,
  message: string
): void {
  violations.push({ rule, path: filePath, line, message });
}

function hasChangedLine(file: FileSnapshot, line: number): boolean {
  if (!file.changedLines || file.status === 'A') return true;
  if (file.changedLines.size === 0) return false;

  return file.changedLines.has(line);
}

function addViolationOnChangedLine(
  file: FileSnapshot,
  violations: GuardrailViolation[],
  rule: string,
  line: number,
  message: string
): void {
  if (!hasChangedLine(file, line)) return;

  addViolation(violations, rule, file.path, line, message);
}

function contentAfterLeadingComments(content: string): string {
  let index = 0;

  while (index < content.length) {
    const whitespaceMatch = /\s*/y;
    whitespaceMatch.lastIndex = index;
    const whitespace = whitespaceMatch.exec(content);
    index = whitespaceMatch.lastIndex;

    if (content.startsWith('//', index)) {
      const newlineIndex = content.indexOf('\n', index + 2);
      index = newlineIndex === -1 ? content.length : newlineIndex + 1;
      continue;
    }

    if (content.startsWith('/*', index)) {
      const commentEnd = content.indexOf('*/', index + 2);
      if (commentEnd === -1) return '';
      index = commentEnd + 2;
      continue;
    }

    break;
  }

  return content.slice(index);
}

function useClientDirectiveLine(content: string): number | null {
  const afterLeading = contentAfterLeadingComments(content);
  const leadingWhitespace = /^\s*/.exec(afterLeading)?.[0].length ?? 0;
  const directiveIndex = content.length - afterLeading.length + leadingWhitespace;

  if (!/^(['"])use client\1(?:;|\s*(?:(?:\/\/.*)?(?:\r?\n|$)))/.test(afterLeading.trimStart())) {
    return null;
  }

  return lineNumberForIndex(content, directiveIndex);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requestBodyVariableNames(content: string): Set<string> {
  const requestParameterRegex = /\b([A-Za-z_$][\w$]*)\s*:\s*(?:Request|NextRequest)\b/g;
  const contextualRouteParameterRegex =
    /\bhandleRoute\s*\(\s*(?:async\s*)?\(?\s*([A-Za-z_$][\w$]*)\b/g;
  const names = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = requestParameterRegex.exec(content)) !== null) {
    names.add(match[1]);
  }

  while ((match = contextualRouteParameterRegex.exec(content)) !== null) {
    names.add(match[1]);
  }

  return names;
}

function checkApiRoute(file: FileSnapshot, violations: GuardrailViolation[]): void {
  if (!file.path.startsWith('src/app/api/v1/') || !isSourceFile(file.path)) return;

  const requestVariables = requestBodyVariableNames(file.content);

  const lines = file.content.split('\n');
  lines.forEach((line, index) => {
    if (
      Array.from(requestVariables).some((name) =>
        new RegExp(`\\b${escapeRegExp(name)}\\.json\\s*\\(`).test(line)
      )
    ) {
      addViolationOnChangedLine(
        file,
        violations,
        API_RAW_JSON_RULE,
        lineNumberForLine(lines, index),
        'API v1 routes must validate request bodies through parseBody(), not raw request.json().'
      );
    }

    if (/\bNextResponse\.json\s*\(/.test(line)) {
      addViolationOnChangedLine(
        file,
        violations,
        API_RAW_NEXT_RESPONSE_RULE,
        lineNumberForLine(lines, index),
        'API v1 routes must use handleRoute()/ApiError response helpers instead of raw NextResponse.json().'
      );
    }
  });
}

function checkClientConsoleLog(file: FileSnapshot, violations: GuardrailViolation[]): void {
  if (!file.path.startsWith('src/') || !isSourceFile(file.path) || isTestFile(file.path)) return;
  const directiveLine = useClientDirectiveLine(file.content);
  if (directiveLine === null) return;

  const directiveChanged = hasChangedLine(file, directiveLine);
  const lines = file.content.split('\n');
  lines.forEach((line, index) => {
    const lineNumber = lineNumberForLine(lines, index);
    if (/\bconsole\.log\s*\(/.test(line)) {
      if (!directiveChanged && !hasChangedLine(file, lineNumber)) return;

      addViolation(
        violations,
        CLIENT_CONSOLE_LOG_RULE,
        file.path,
        lineNumber,
        'Do not leave console.log in client components; surface state in UI or remove debug logging.'
      );
    }
  });
}

function checkDeepImports(file: FileSnapshot, violations: GuardrailViolation[]): void {
  if (!file.path.startsWith('src/') || !isSourceFile(file.path) || isTestFile(file.path)) return;

  const importRegex = /(?:from\s+|import\s*\(\s*|import\s+)['"](@\/features\/([^/'"]+)\/([^'"]+))['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(file.content)) !== null) {
    const importPath = match[1];
    const featureName = match[2];
    const subpath = match[3];
    const specifierIndex = match.index + match[0].indexOf(importPath);

    if (subpath === 'server' || subpath === 'client') continue;
    if (file.path.startsWith(`src/features/${featureName}/`)) continue;

    addViolationOnChangedLine(
      file,
      violations,
      DEEP_IMPORT_RULE,
      lineNumberForIndex(file.content, specifierIndex),
      `Import from the feature barrel or server entry point instead of deep path ${importPath}.`
    );
  }
}

function isUiFile(filePath: string): boolean {
  if (!filePath.startsWith('src/')) return false;
  if (filePath.startsWith('src/app/api/')) return false;
  if (filePath.includes('/queries/') || filePath.includes('/actions/') || filePath.includes('/server')) {
    return false;
  }
  if (filePath.startsWith('src/lib/i18n/')) return false;

  return (
    filePath.startsWith('src/app/') ||
    filePath.includes('/components/') ||
    filePath.endsWith('Content.tsx')
  );
}

function checkDirectLocaleFormatting(file: FileSnapshot, violations: GuardrailViolation[]): void {
  if (!isSourceFile(file.path) || isTestFile(file.path) || !isUiFile(file.path)) return;

  const lines = file.content.split('\n');
  lines.forEach((line, index) => {
    if (/\.(?:toLocaleDateString|toLocaleTimeString|toLocaleString)\s*\(/.test(line)) {
      addViolationOnChangedLine(
        file,
        violations,
        UI_LOCALE_FORMATTING_RULE,
        lineNumberForLine(lines, index),
        'Use centralized date/time/number formatters instead of direct locale formatting in UI files.'
      );
    }
  });
}

function findMatchingParen(content: string, openParenIndex: number): number {
  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = openParenIndex; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '(') depth += 1;
    if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function isExecutableIndex(content: string, targetIndex: number): boolean {
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < targetIndex; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
    }
  }

  return !quote && !inLineComment && !inBlockComment;
}

function splitTopLevelArgs(callText: string): Array<{ text: string; start: number }> {
  const args: Array<{ text: string; start: number }> = [];
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;
  let argStart = 0;

  for (let index = 0; index < callText.length; index += 1) {
    const char = callText[index];
    const next = callText[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth -= 1;
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth -= 1;
    if (char === '{') braceDepth += 1;
    if (char === '}') braceDepth -= 1;

    if (char === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      const rawArg = callText.slice(argStart, index);
      const leadingWhitespace = /^\s*/.exec(rawArg)?.[0].length ?? 0;
      args.push({ text: rawArg.trim(), start: argStart + leadingWhitespace });
      argStart = index + 1;
    }
  }

  const rawArg = callText.slice(argStart);
  const leadingWhitespace = /^\s*/.exec(rawArg)?.[0].length ?? 0;
  if (rawArg.trim() !== '') {
    args.push({ text: rawArg.trim(), start: argStart + leadingWhitespace });
  }

  return args;
}

function checkPostMessage(file: FileSnapshot, violations: GuardrailViolation[]): void {
  if (
    !(
      (file.path.startsWith('src/') && isSourceFile(file.path)) ||
      isStaticGameFile(file.path)
    )
  ) {
    return;
  }

  let searchIndex = 0;

  while (searchIndex < file.content.length) {
    const callIndex = file.content.indexOf('postMessage', searchIndex);
    if (callIndex === -1) break;

    const before = file.content[callIndex - 1];
    const after = file.content[callIndex + 'postMessage'.length];
    if (
      /[\w$]/.test(before ?? '') ||
      /[\w$]/.test(after ?? '') ||
      !isExecutableIndex(file.content, callIndex)
    ) {
      searchIndex = callIndex + 'postMessage'.length;
      continue;
    }

    const openParenIndex = file.content.indexOf('(', callIndex + 'postMessage'.length);
    if (openParenIndex === -1) break;

    const closeParenIndex = findMatchingParen(file.content, openParenIndex);
    if (closeParenIndex === -1) {
      searchIndex = openParenIndex + 1;
      continue;
    }

    const callText = file.content.slice(openParenIndex + 1, closeParenIndex);
    const args = splitTopLevelArgs(callText);
    const targetOriginArg = args[1];
    if (!targetOriginArg) {
      searchIndex = closeParenIndex + 1;
      continue;
    }

    const wildcardString = /^['"`]\*['"`]$/.exec(targetOriginArg.text);
    const wildcardOption = /\btargetOrigin\s*:\s*['"`]\*['"`]/.exec(targetOriginArg.text);

    if (wildcardString || wildcardOption) {
      const wildcardOffset = targetOriginArg.text.indexOf('*');
      const wildcardIndex = openParenIndex + 1 + targetOriginArg.start + wildcardOffset;
      addViolationOnChangedLine(
        file,
        violations,
        POSTMESSAGE_RULE,
        lineNumberForIndex(file.content, wildcardIndex),
        "postMessage must target a trusted origin; do not use '*'."
      );
    }

    searchIndex = closeParenIndex + 1;
  }
}

function checkRawUiTokens(file: FileSnapshot, violations: GuardrailViolation[]): void {
  if (
    !file.path.startsWith('src/') ||
    !isSourceFile(file.path) ||
    isTestFile(file.path) ||
    !isUiFile(file.path)
  ) {
    return;
  }

  const rawTokenRegex = /#[0-9a-fA-F]{3,8}\b|\b(?:bg|shadow|rounded)-\[[^\]]+\]/;
  const lines = file.content.split('\n');

  lines.forEach((line, index) => {
    if (rawTokenRegex.test(line)) {
      addViolationOnChangedLine(
        file,
        violations,
        RAW_UI_TOKEN_RULE,
        lineNumberForLine(lines, index),
        'Use EduPlay/Seesaw design tokens instead of raw hex colors or arbitrary bg/shadow/radius classes.'
      );
    }
  });
}

function checkUiInteractionPatterns(file: FileSnapshot, violations: GuardrailViolation[]): void {
  if (
    !file.path.startsWith('src/') ||
    !isSourceFile(file.path) ||
    isTestFile(file.path) ||
    !isUiFile(file.path)
  ) {
    return;
  }

  const scaleHoverRegex =
    /\b(?:motion-safe:)?(?:group-)?hover:scale-(?:[\w.-]+|\[[^\]\s]+\])(?=$|\s|["'`])|\bmotion-safe:group-hover:scale-(?:[\w.-]+|\[[^\]\s]+\])(?=$|\s|["'`])/;
  const lines = file.content.split('\n');

  lines.forEach((line, index) => {
    if (scaleHoverRegex.test(line)) {
      addViolationOnChangedLine(
        file,
        violations,
        UI_SCALE_HOVER_RULE,
        lineNumberForLine(lines, index),
        'Use EduPlay/Seesaw interaction tokens: cards/buttons may raise shadow or darken color, but production UI must not scale on hover.'
      );
    }
  });
}

function extractUsingPredicate(policyBlock: string): string | null {
  const usingMatch = /\bUSING\s*\(/i.exec(policyBlock);
  if (!usingMatch) return null;

  const openParenIndex = policyBlock.indexOf('(', usingMatch.index);
  const closeParenIndex = findMatchingParen(policyBlock, openParenIndex);
  if (closeParenIndex === -1) return null;

  return policyBlock.slice(openParenIndex + 1, closeParenIndex);
}

function splitTopLevelOrClauses(predicate: string): string[] {
  const clauses: string[] = [];
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let depth = 0;
  let clauseStart = 0;

  for (let index = 0; index < predicate.length; index += 1) {
    const char = predicate[index];
    const next = predicate[index + 1];

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;

    const before = predicate[index - 1] ?? '';
    const after = predicate[index + 2] ?? '';
    if (
      depth === 0 &&
      /^OR\b/i.test(predicate.slice(index)) &&
      !/[\w$]/.test(before) &&
      !/[\w$]/.test(after)
    ) {
      clauses.push(predicate.slice(clauseStart, index));
      clauseStart = index + 2;
      index += 1;
    }
  }

  clauses.push(predicate.slice(clauseStart));

  return clauses;
}

function hasBlanketNullPredicate(policyBlock: string): boolean {
  const predicate = extractUsingPredicate(policyBlock) ?? policyBlock;
  const nullPredicateRegex = /\b(?:[A-Za-z_$][\w$]*\.)?[A-Za-z_$][\w$]*\s+IS\s+NULL\b/gi;

  return splitTopLevelOrClauses(predicate).some((clause) => {
    nullPredicateRegex.lastIndex = 0;
    if (!nullPredicateRegex.test(clause)) return false;

    nullPredicateRegex.lastIndex = 0;
    const scopedRemainder = clause
      .replace(nullPredicateRegex, '')
      .replace(/\b(?:AND|OR|NOT)\b/gi, '')
      .replace(/[();\s]/g, '');

    nullPredicateRegex.lastIndex = 0;
    return scopedRemainder.length === 0;
  });
}

function checkRlsSelectPolicies(file: FileSnapshot, violations: GuardrailViolation[]): void {
  if (!file.path.startsWith('supabase/migrations/') || !isSqlFile(file.path)) return;

  const policyRegex = /CREATE\s+POLICY\b[\s\S]*?;/gi;
  let match: RegExpExecArray | null;

  while ((match = policyRegex.exec(file.content)) !== null) {
    const policyBlock = match[0];
    const explicitCommand = /\bFOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\b/i.exec(policyBlock);
    const appliesToSelect =
      !explicitCommand || /^(SELECT|ALL)$/i.test(explicitCommand[1]);

    if (appliesToSelect && hasBlanketNullPredicate(policyBlock)) {
      const startLine = lineNumberForIndex(file.content, match.index);
      const lineCount = policyBlock.split('\n').length;
      const changedPolicyLine =
        !file.changedLines ||
        file.status === 'A' ||
        Array.from(file.changedLines).some(
          (line) => line >= startLine && line < startLine + lineCount
        );

      if (!changedPolicyLine) continue;

      addViolation(
        violations,
        RLS_NULL_SELECT_RULE,
        file.path,
        lineNumberForIndex(file.content, match.index),
        'SELECT RLS policies must not grant blanket visibility with IS NULL predicates.'
      );
    }
  }
}

function checkRouteBoundaries(
  file: FileSnapshot,
  violations: GuardrailViolation[],
  options: CheckOptions
): void {
  if (!file.path.startsWith('src/app/') || !file.path.endsWith('/page.tsx')) return;
  if (file.path.startsWith('src/app/api/')) return;
  if (file.status && !['A', 'C', 'R'].includes(file.status)) return;

  const directory = path.posix.dirname(file.path);
  const snapshots = new Set<string>();
  const exists =
    options.fileExists ??
    ((candidate: string) => {
      if (snapshots.size === 0) return false;
      return snapshots.has(candidate);
    });

  const loadingPath = `${directory}/loading.tsx`;
  const errorPath = `${directory}/error.tsx`;

  if (exists(loadingPath) && exists(errorPath)) return;

  addViolation(
    violations,
    ROUTE_BOUNDARY_RULE,
    file.path,
    1,
    'New or changed route pages must include sibling loading.tsx and error.tsx boundaries.'
  );
}

export function checkFiles(files: FileSnapshot[], options: CheckOptions = {}): GuardrailViolation[] {
  const normalizedFiles = files.map((file) => ({
    path: normalizePath(file.path),
    content: file.content,
    changedLines: file.changedLines,
    status: file.status,
  }));

  const snapshotPaths = new Set(normalizedFiles.map((file) => file.path));
  const fileExists =
    options.fileExists ??
    ((candidate: string) => snapshotPaths.has(normalizePath(candidate)));

  const violations: GuardrailViolation[] = [];

  normalizedFiles.forEach((file) => {
    checkApiRoute(file, violations);
    checkClientConsoleLog(file, violations);
    checkDeepImports(file, violations);
    checkDirectLocaleFormatting(file, violations);
    checkPostMessage(file, violations);
    checkRawUiTokens(file, violations);
    checkUiInteractionPatterns(file, violations);
    checkRlsSelectPolicies(file, violations);
    checkRouteBoundaries(file, violations, { fileExists });
  });

  return violations;
}

export function shouldRunTypesDrift(changedPaths: Array<string | ChangedEntry>): boolean {
  return changedPaths
    .map((entry) => normalizePath(typeof entry === 'string' ? entry : entry.path))
    .some((filePath) => filePath.startsWith('supabase/migrations/') && filePath.endsWith('.sql'));
}

const GIT_OUTPUT_BUFFER_BYTES = 64 * 1024 * 1024;

function git(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: GIT_OUTPUT_BUFFER_BYTES,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

type GitCommand = (args: string[]) => string;

type GetChangedEntriesOptions = {
  env?: Record<string, string | undefined>;
  git?: GitCommand;
};

function fetchRemoteCandidate(candidate: string, gitCommand: GitCommand): void {
  const match = /^origin\/(.+)$/.exec(candidate);
  if (!match) return;

  const branch = match[1];
  gitCommand(['fetch', '--depth=200', 'origin', `${branch}:refs/remotes/origin/${branch}`]);
}

function mergeEntry(
  entries: Map<string, ChangedEntry>,
  pathName: string,
  status: ChangedPathStatus,
  changedLines: ReadonlySet<number> = new Set()
): void {
  const normalizedPath = normalizePath(pathName);
  const existing = entries.get(normalizedPath);

  if (!existing) {
    entries.set(normalizedPath, {
      path: normalizedPath,
      status,
      changedLines: new Set(changedLines),
    });
    return;
  }

  const mergedLines = new Set([...existing.changedLines, ...changedLines]);
  entries.set(normalizedPath, {
    path: normalizedPath,
    status: existing.status === 'A' ? 'A' : status,
    changedLines: mergedLines,
  });
}

function parseNameStatus(output: string): Array<{ path: string; status: ChangedPathStatus }> {
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [rawStatus, firstPath, secondPath] = line.split('\t');
      const status = rawStatus[0] as ChangedPathStatus;
      const pathName = status === 'R' || status === 'C' ? secondPath : firstPath;

      return { path: pathName, status };
    });
}

function parseChangedLines(output: string): Map<string, Set<number>> {
  const changedLinesByPath = new Map<string, Set<number>>();
  let currentPath: string | null = null;

  output.split(/\r?\n/).forEach((line) => {
    if (line.startsWith('+++ b/')) {
      currentPath = normalizePath(line.slice('+++ b/'.length));
      if (!changedLinesByPath.has(currentPath)) changedLinesByPath.set(currentPath, new Set());
      return;
    }

    if (!currentPath || !line.startsWith('@@')) return;

    const match = /\+(\d+)(?:,(\d+))?/.exec(line);
    if (!match) return;

    const start = Number.parseInt(match[1], 10);
    const count = match[2] ? Number.parseInt(match[2], 10) : 1;
    const changedLines = changedLinesByPath.get(currentPath);
    if (!changedLines || count === 0) return;

    for (let lineNumber = start; lineNumber < start + count; lineNumber += 1) {
      changedLines.add(lineNumber);
    }
  });

  return changedLinesByPath;
}

function collectDiffEntries(
  entries: Map<string, ChangedEntry>,
  gitCommand: GitCommand,
  diffTargetArgs: string[]
): void {
  const nameStatus = gitCommand([
    'diff',
    '--relative',
    '--name-status',
    '--diff-filter=ACMRD',
    ...diffTargetArgs,
  ]);
  const changedLines = parseChangedLines(
    gitCommand(['diff', '--relative', '--unified=0', '--no-ext-diff', '--diff-filter=ACMR', ...diffTargetArgs])
  );

  parseNameStatus(nameStatus).forEach((entry) => {
    mergeEntry(entries, entry.path, entry.status, changedLines.get(normalizePath(entry.path)));
  });
}

function collectUntrackedEntries(entries: Map<string, ChangedEntry>, gitCommand: GitCommand): void {
  const output = gitCommand(['ls-files', '--others', '--exclude-standard']);

  output
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((pathName) => mergeEntry(entries, pathName, 'A'));
}

function resolveDiffBase(
  env: Record<string, string | undefined>,
  gitCommand: GitCommand
): string {
  const explicitBase = env.AGENT_GUARDRAILS_BASE;
  const candidates = explicitBase
    ? [explicitBase]
    : [
        env.CHANGE_TARGET ? `origin/${env.CHANGE_TARGET}` : undefined,
        env.CHANGE_TARGET,
        'origin/main',
        'main',
        'origin/HEAD',
      ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return gitCommand(['merge-base', candidate, 'HEAD']);
    } catch {
      if (explicitBase) break;

      try {
        fetchRemoteCandidate(candidate, gitCommand);
        return gitCommand(['merge-base', candidate, 'HEAD']);
      } catch {
        // Try the next candidate below.
      }
    }
  }

  throw new Error(
    'Unable to resolve a guardrail diff base. Fetch origin/main or set AGENT_GUARDRAILS_BASE to a valid base ref.'
  );
}

export function getChangedEntries(options: GetChangedEntriesOptions = {}): ChangedEntry[] {
  const gitCommand = options.git ?? git;
  const env = options.env ?? process.env;
  const entries = new Map<string, ChangedEntry>();
  const mergeBase = resolveDiffBase(env, gitCommand);

  collectDiffEntries(entries, gitCommand, [`${mergeBase}...HEAD`]);
  collectDiffEntries(entries, gitCommand, []);
  collectDiffEntries(entries, gitCommand, ['--cached']);
  collectUntrackedEntries(entries, gitCommand);

  return Array.from(entries.values());
}

function readChangedFiles(changedEntries: ChangedEntry[]): FileSnapshot[] {
  return changedEntries
    .filter((entry) => entry.status !== 'D')
    .filter((entry) => existsSync(entry.path))
    .filter(
      (entry) =>
        entry.path.startsWith('src/') ||
        entry.path.startsWith('supabase/migrations/') ||
        entry.path.startsWith('public/games/')
    )
    .filter((entry) => isSourceFile(entry.path) || isSqlFile(entry.path) || isStaticGameFile(entry.path))
    .map((entry) => ({
      path: entry.path,
      content: readFileSync(entry.path, 'utf8'),
      changedLines: entry.changedLines,
      status: entry.status,
    }));
}

function printViolations(violations: GuardrailViolation[]): void {
  violations.forEach((violation) => {
    console.error(
      `${violation.path}:${violation.line} ${violation.rule} - ${violation.message}`
    );
  });
}

function runTypesDriftIfNeeded(changedPaths: Array<string | ChangedEntry>): number {
  if (!shouldRunTypesDrift(changedPaths)) {
    console.log('Supabase migrations unchanged; skipping type drift check.');
    return 0;
  }

  const result = spawnSync('npm', ['run', 'check:types-drift'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  return result.status ?? 1;
}

function main(): number {
  const args = new Set(process.argv.slice(2));
  let changedEntries: ChangedEntry[];

  try {
    changedEntries = getChangedEntries();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const snapshots = readChangedFiles(changedEntries);
  const violations = checkFiles(snapshots, {
    fileExists: (candidate) => existsSync(candidate),
  });

  if (violations.length > 0) {
    printViolations(violations);
    return 1;
  }

  console.log(`Agent guardrails passed for ${snapshots.length} changed source/migration files.`);

  if (args.has('--types-drift-if-needed')) {
    return runTypesDriftIfNeeded(changedEntries);
  }

  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

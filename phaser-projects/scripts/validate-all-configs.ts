#!/usr/bin/env ts-node
/**
 * Validate every game configuration artifact across all Activity versions.
 *
 * Walks `activities/{activityId}/versions/{version}/` looking for:
 *   - config.json         -> gameConfigSchema (discriminated on meta.gameType)
 *   - strings/*.json      -> gameStringsSchema (language files)
 *   - assets.json         -> well-formed Activity asset manifest object
 *
 * Returns non-zero exit code if any file fails validation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  activityAssetRegistrySchema,
  activityMetadataSchema,
  gameStringsSchema,
  parseGameConfig,
  validateActivityAssetPins
} from '@edu-play/validation';

interface ValidationResult {
  file: string;
  success: boolean;
  errors?: unknown;
}

type Parser = (data: unknown) => { success: boolean; error?: { format: () => unknown } };

function validateFile(filePath: string, parser: Parser): ValidationResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const result = parser(data);

    if (result.success) {
      return { file: filePath, success: true };
    }
    return {
      file: filePath,
      success: false,
      errors: result.error?.format()
    };
  } catch (error) {
    return {
      file: filePath,
      success: false,
      errors: { _parseError: error instanceof Error ? error.message : String(error) }
    };
  }
}

function report(label: string, files: string[], rootDir: string, results: ValidationResult[]) {
  if (files.length === 0) return;
  console.log(`\n${label} (${files.length}):`);
  for (const file of files) {
    const result = results.find(r => r.file === file);
    if (!result) continue;
    const rel = path.relative(rootDir, file);
    if (result.success) {
      console.log(`  ✓ ${rel}`);
    } else {
      console.error(`  ✗ ${rel}`);
      console.error(`    ${JSON.stringify(result.errors, null, 2).replace(/\n/g, '\n    ')}`);
    }
  }
}

function parseRootDir(args: string[]): string {
  const rootFlagIndex = args.indexOf('--root');
  if (rootFlagIndex !== -1) {
    const rootValue = args[rootFlagIndex + 1];
    if (!rootValue) {
      throw new Error('Missing value for --root');
    }
    return path.resolve(rootValue);
  }

  return process.cwd();
}

function readJsonIfValid<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function validateActivityAssetManifestForGame(data: unknown, gameId?: string): ReturnType<Parser> {
  const structuralResult = activityAssetRegistrySchema.safeParse(data);
  if (!structuralResult.success) return structuralResult;

  if (!gameId) {
    return {
      success: false,
      error: { format: () => ({ _errors: ['Unable to resolve Activity gameId for asset manifest'] }) }
    };
  }

  const pinResult = validateActivityAssetPins(structuralResult.data, gameId);
  if (pinResult.success) return { success: true };

  return {
    success: false,
    error: { format: () => ({ _errors: pinResult.errors }) }
  };
}

async function main(): Promise<void> {
  const rootDir = parseRootDir(process.argv.slice(2));
  console.log('🔍 Validating every game config artifact under activities/*/versions/*/');

  const activityFiles = (await glob('activities/*/activity.json', {
    cwd: rootDir,
    absolute: true
  })).sort();

  const configFiles: string[] = [];
  const langFiles: string[] = [];
  const assetManifestFiles: string[] = [];
  const assetManifestGameIds = new Map<string, string>();

  for (const activityFile of activityFiles) {
    const activityResult = validateFile(activityFile, (d) => activityMetadataSchema.safeParse(d));
    if (!activityResult.success) continue;

    const activity = activityMetadataSchema.parse(JSON.parse(fs.readFileSync(activityFile, 'utf-8')));
    const activityRoot = path.dirname(activityFile);
    const versionRoot = path.join(activityRoot, 'versions', String(activity.version));
    const configFile = path.join(versionRoot, 'config.json');
    const assetManifestFile = path.join(versionRoot, 'assets.json');

    configFiles.push(configFile);
    assetManifestFiles.push(assetManifestFile);
    assetManifestGameIds.set(assetManifestFile, activity.gameId);

    if (fs.existsSync(configFile)) {
      const config = readJsonIfValid<{ meta?: { supportedLanguages?: string[] } }>(configFile);
      for (const language of config?.meta?.supportedLanguages ?? ['en', 'ro']) {
        langFiles.push(path.join(versionRoot, 'strings', `${language}.json`));
      }
    }
  }

  configFiles.sort();
  langFiles.sort();
  assetManifestFiles.sort();

  const results: ValidationResult[] = [];

  for (const file of activityFiles) {
    results.push(validateFile(file, (d) => activityMetadataSchema.safeParse(d)));
  }
  for (const file of configFiles) {
    results.push(validateFile(file, parseGameConfig));
  }
  for (const file of langFiles) {
    results.push(validateFile(file, (d) => gameStringsSchema.safeParse(d)));
  }
  for (const file of assetManifestFiles) {
    const gameId = assetManifestGameIds.get(file);
    results.push(validateFile(file, (d) => validateActivityAssetManifestForGame(d, gameId)));
  }

  report('Activity metadata', activityFiles, rootDir, results);
  report('Activity game configs', configFiles, rootDir, results);
  report('Language strings', langFiles, rootDir, results);
  report('Activity asset manifests', assetManifestFiles, rootDir, results);

  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = total - passed;

  console.log('\n' + '='.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total files : ${total}`);
  console.log(`✓ Passed    : ${passed}`);
  console.log(`✗ Failed    : ${failed}`);

  if (failed > 0) {
    console.log('\n⚠️  Some configurations failed validation');
    process.exit(1);
  }

  console.log('\n✓ All configurations are valid');
  process.exit(0);
}

main();

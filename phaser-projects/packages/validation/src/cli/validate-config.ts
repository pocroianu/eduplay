#!/usr/bin/env node
/**
 * CLI tool to validate game configuration files.
 *
 * Dispatches by filename:
 *   config.json    -> gameConfigSchema (discriminated on meta.gameType)
 *   catalog.json   -> gameCatalogSchema
 *   {lang}.json    -> gameStringsSchema
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  gameCatalogSchema,
  gameStringsSchema,
  parseGameConfig
} from '../schemas/game-config.schema';
import {
  activityAssetRegistrySchema,
  activityMetadataSchema,
  validateActivityAssetPins
} from '../schemas/activity.schema';

type Parser = (data: unknown) => { success: boolean; error?: { format: () => unknown } };

function formatErrors(errors: unknown): string {
  return JSON.stringify(errors, null, 2);
}

function validateFile(filePath: string, parser: Parser, schemaName: string): boolean {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    const result = parser(data);

    if (result.success) {
      console.log(`✓ ${schemaName} validation passed: ${filePath}`);
      return true;
    }

    console.error(`✗ ${schemaName} validation failed: ${filePath}`);
    console.error('Errors:');
    console.error(formatErrors(result.error?.format()));
    return false;
  } catch (error) {
    console.error(`✗ Error reading/parsing file: ${filePath}`);
    console.error(error);
    return false;
  }
}

function validateActivityAssetManifestFile(data: unknown, filePath: string): ReturnType<Parser> {
  const structuralResult = activityAssetRegistrySchema.safeParse(data);
  if (!structuralResult.success) return structuralResult;

  const gameId = resolveSiblingActivityGameId(filePath);
  if (!gameId) {
    return {
      success: false,
      error: { format: () => ({ _errors: ['Unable to resolve sibling Activity gameId for asset manifest'] }) }
    };
  }

  const pinResult = validateActivityAssetPins(structuralResult.data, gameId);
  if (pinResult.success) return { success: true };

  return {
    success: false,
    error: { format: () => ({ _errors: pinResult.errors }) }
  };
}

function resolveSiblingActivityGameId(filePath: string): string | null {
  const activityPath = path.resolve(path.dirname(filePath), '..', '..', 'activity.json');
  if (!fs.existsSync(activityPath)) return null;

  try {
    const activityResult = activityMetadataSchema.safeParse(JSON.parse(fs.readFileSync(activityPath, 'utf-8')));
    return activityResult.success ? activityResult.data.gameId : null;
  } catch {
    return null;
  }
}

function resolveParser(filePath: string): { parser: Parser; name: string } | null {
  const fileName = path.basename(filePath);
  if (fileName === 'activity.json') {
    return {
      parser: (data) => activityMetadataSchema.safeParse(data),
      name: 'ActivityMetadata'
    };
  }
  if (fileName === 'assets.json') {
    return {
      parser: (data) => validateActivityAssetManifestFile(data, filePath),
      name: 'ActivityAssetRegistry'
    };
  }
  if (fileName === 'config.json') {
    return { parser: parseGameConfig, name: 'GameConfig' };
  }
  if (fileName === 'catalog.json') {
    return {
      parser: (data) => gameCatalogSchema.safeParse(data),
      name: 'GameCatalog'
    };
  }
  if (fileName.endsWith('.json')) {
    return {
      parser: (data) => gameStringsSchema.safeParse(data),
      name: 'GameStrings'
    };
  }
  return null;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: validate-config <path-to-config-file>');
    console.log('');
    console.log('Examples:');
    console.log('  validate-config activities/fruits-01/activity.json');
    console.log('  validate-config activities/animals-match-01/versions/1/config.json');
    console.log('  validate-config activities/fruits-01/versions/1/strings/en.json');
    console.log('  validate-config activities/fruits-01/versions/1/assets.json');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const resolved = resolveParser(filePath);
  if (!resolved) {
    console.error('Unknown file type. Expected config.json, catalog.json, or a language file (en.json, ro.json, etc.)');
    process.exit(1);
  }

  const success = validateFile(filePath, resolved.parser, resolved.name);
  process.exit(success ? 0 : 1);
}

main();

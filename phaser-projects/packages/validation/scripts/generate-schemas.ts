/**
 * Generate JSON Schema files from Zod schemas
 * Enables VSCode autocomplete and validation for config files
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  baseGameConfigSchema,
  categorizeGameConfigSchema,
  countingGameConfigSchema,
  gameCatalogSchema,
  gameStringsSchema,
  hydratedGameConfigSchema,
  listenTapGameConfigSchema,
  matchingGameConfigSchema,
  memoryGameConfigSchema,
  multipleChoiceGameConfigSchema,
  patternGameConfigSchema,
  repeatSequenceGameConfigSchema,
  sequenceGameConfigSchema,
  tracingGameConfigSchema
} from '../src/schemas/game-config.schema';
import {
  themeConfigSchema,
  themeDefinitionSchema
} from '../src/schemas/theme-config.schema';
import {
  activityAssetRegistrySchema,
  activityMetadataSchema
} from '../src/schemas/activity.schema';

// Output directory
const SCHEMAS_DIR = path.join(__dirname, '../../../docs/schemas');

export interface GeneratedSchema {
  name: string;
  schema: Record<string, unknown>;
}

const GAME_CONFIG_SCHEMAS: Array<{ name: string; schema: ZodTypeAny; description: string }> = [
  {
    name: 'game-config.multipleChoice',
    schema: multipleChoiceGameConfigSchema,
    description: 'Multiple-choice game configuration'
  },
  {
    name: 'game-config.matching',
    schema: matchingGameConfigSchema,
    description: 'Matching game configuration'
  },
  {
    name: 'game-config.memory',
    schema: memoryGameConfigSchema,
    description: 'Memory game configuration'
  },
  {
    name: 'game-config.categorize',
    schema: categorizeGameConfigSchema,
    description: 'Categorize game configuration'
  },
  {
    name: 'game-config.sequence',
    schema: sequenceGameConfigSchema,
    description: 'Sequence ordering game configuration'
  },
  {
    name: 'game-config.tracing',
    schema: tracingGameConfigSchema,
    description: 'Tracing game configuration'
  },
  {
    name: 'game-config.counting',
    schema: countingGameConfigSchema,
    description: 'Counting game configuration'
  },
  {
    name: 'game-config.pattern',
    schema: patternGameConfigSchema,
    description: 'Pattern game configuration'
  },
  {
    name: 'game-config.repeat-sequence',
    schema: repeatSequenceGameConfigSchema,
    description: 'Repeat-sequence game configuration'
  },
  {
    name: 'game-config.listen-tap',
    schema: listenTapGameConfigSchema,
    description: 'Listen-tap game configuration'
  }
];

/**
 * Build all JSON Schema documents without writing them to disk.
 */
export function buildGeneratedSchemas(): GeneratedSchema[] {
  const perTemplateSchemas = GAME_CONFIG_SCHEMAS.map(({ name, schema, description }) => ({
    name,
    schema: toJsonSchema(name, schema, description)
  }));

  return [
    // Backward compatibility: callers may still reference this legacy file.
    {
      name: 'base-game-config',
      schema: toJsonSchema(
        'base-game-config',
        baseGameConfigSchema,
        'Base game configuration (legacy multiple-choice shape)'
      )
    },
    {
      name: 'game-config',
      schema: buildGameConfigIndexSchema(perTemplateSchemas)
    },
    ...perTemplateSchemas,
    {
      name: 'game-strings',
      schema: toJsonSchema(
        'game-strings',
        gameStringsSchema,
        'Language-specific strings for game content'
      )
    },
    {
      name: 'hydrated-game-config',
      schema: toJsonSchema(
        'hydrated-game-config',
        hydratedGameConfigSchema,
        'Fully hydrated game configuration (runtime)'
      )
    },
    {
      name: 'game-catalog',
      schema: toJsonSchema('game-catalog', gameCatalogSchema, 'Game catalog manifest')
    },
    {
      name: 'activity',
      schema: toJsonSchema('activity', activityMetadataSchema, 'Activity metadata')
    },
    {
      name: 'activity-assets',
      schema: toJsonSchema('activity-assets', activityAssetRegistrySchema, 'Activity-version asset manifest')
    },
    {
      name: 'theme-config',
      schema: toJsonSchema('theme-config', themeConfigSchema, 'Theme configuration')
    },
    {
      name: 'theme-definition',
      schema: toJsonSchema('theme-definition', themeDefinitionSchema, 'Theme definition with metadata')
    }
  ];
}

/**
 * Build the VSCode json.schemas settings snippet printed after generation.
 */
export function buildVSCodeJsonSchemasSnippet(): string {
  return `{
  "json.schemas": [
    {
      "fileMatch": ["activities/*/activity.json"],
      "url": "./docs/schemas/activity.schema.json"
    },
    {
      "fileMatch": ["activities/*/versions/*/config.json"],
      "url": "./docs/schemas/game-config.schema.json"
    },
    {
      "fileMatch": [
        "activities/*/versions/*/strings/en.json",
        "activities/*/versions/*/strings/ro.json"
      ],
      "url": "./docs/schemas/game-strings.schema.json"
    },
    {
      "fileMatch": ["activities/*/versions/*/assets.json"],
      "url": "./docs/schemas/activity-assets.schema.json"
    }
  ]
}`;
}

/**
 * Generate all schemas.
 */
export function main(): void {
  console.log('Generating JSON Schemas from Zod schemas...\n');

  ensureOutputDirectory(SCHEMAS_DIR);

  for (const generated of buildGeneratedSchemas()) {
    writeSchema(generated, SCHEMAS_DIR);
  }

  console.log(`\n✓ All schemas generated in ${SCHEMAS_DIR}`);
  console.log('\nTo use in VSCode, add to .vscode/settings.json:');
  console.log(buildVSCodeJsonSchemasSnippet());
  console.log('\nLegacy multiple-choice callers can keep using ./docs/schemas/base-game-config.schema.json.');
}

function toJsonSchema(
  name: string,
  schema: ZodTypeAny,
  description: string
): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema as any, {
    name,
    $refStrategy: 'none'
  }) as Record<string, unknown>;

  jsonSchema.description = description;
  return jsonSchema;
}

function buildGameConfigIndexSchema(perTemplateSchemas: GeneratedSchema[]): Record<string, unknown> {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'game-config',
    description: 'Any supported game configuration. Selects the correct per-template schema by meta.gameType.',
    oneOf: perTemplateSchemas.map(({ name }) => ({
      $ref: `./${name}.schema.json`
    }))
  };
}

function ensureOutputDirectory(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Generate and save a JSON Schema.
 */
function writeSchema(generated: GeneratedSchema, outputDir: string): void {
  const filePath = path.join(outputDir, `${generated.name}.schema.json`);
  fs.writeFileSync(filePath, JSON.stringify(generated.schema, null, 2));
  console.log(`✓ Generated ${generated.name}.schema.json`);
}

if (require.main === module) {
  main();
}

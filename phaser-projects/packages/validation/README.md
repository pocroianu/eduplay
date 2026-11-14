# @edu-play/validation

Shared validation schemas and contracts for edu-play Phaser educational games.

## Overview

This package provides:

- **Runtime validation** using Zod for game configurations
- **Type inference** - TypeScript types automatically derived from schemas
- **JSON Schema generation** for VSCode autocomplete and validation
- **API contracts** for manager methods and event payloads
- **Single source of truth** for configuration structure

## Installation

This package is part of the edu-play monorepo workspace:

```bash
npm install
```

## Usage

### Validating Game Configs

```typescript
import { baseGameConfigSchema, gameStringsSchema } from '@edu-play/validation';

// Validate base config
const result = baseGameConfigSchema.safeParse(configData);
if (!result.success) {
  console.error('Validation failed:', result.error.format());
  throw new Error('Invalid game config');
}
const validConfig = result.data;

// Validate language strings
const stringsResult = gameStringsSchema.safeParse(stringsData);
if (!stringsResult.success) {
  console.error('Validation failed:', stringsResult.error.format());
}
```

### Type Inference

```typescript
import type { BaseGameConfig, HydratedGameConfig } from '@edu-play/validation';

// Types are automatically inferred from Zod schemas
function loadConfig(config: BaseGameConfig): HydratedGameConfig {
  // TypeScript knows the exact shape of these types
  // ...
}
```

### Using in ConfigLoader

```typescript
import { baseGameConfigSchema, gameStringsSchema } from '@edu-play/validation';

async loadBaseConfig(activityId: string, version = 1): Promise<BaseGameConfig> {
  const response = await fetch(`/activities/${activityId}/versions/${version}/config.json`);
  const rawConfig = await response.json();

  // Validate with detailed errors
  const result = baseGameConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    console.error('Config validation failed:', result.error.format());
    throw new Error(`Invalid config for game ${gameId}: ${result.error.message}`);
  }

  return result.data;
}
```

## Available Schemas

### Game Configuration

| Schema | Description |
|--------|-------------|
| `parseGameConfig(data)` | Dispatcher — picks a per-template schema based on `meta.gameType` |
| `multipleChoiceGameConfigSchema` | Multiple-choice template config |
| `matchingGameConfigSchema` | Matching-game template config (pairs-based) |
| `memoryGameConfigSchema` | Memory-game template config (pairs-based) |
| `categorizeGameConfigSchema` | Categorize-game template config (categories + items) |
| `sequenceGameConfigSchema` | Sequence-order template config (ordered items) |
| `tracingGameConfigSchema` | Tracing-game template config (items + strokes) |
| `baseGameConfigSchema` | Alias of `multipleChoiceGameConfigSchema` (legacy) |
| `gameStringsSchema` | Language-specific strings (per-template fields optional) |
| `hydratedGameConfigSchema` | Fully hydrated runtime config |
| `baseQuestionSchema` | Single question (language-agnostic) |
| `hydratedQuestionSchema` | Single question (hydrated) |
| `gameCatalogSchema` | Game catalog manifest |

### Per-template discrimination

Game configs are discriminated by `meta.gameType`. Prefer `parseGameConfig` for
authoring-time validation; it picks the right schema automatically and defaults
missing `gameType` to `multipleChoice` for legacy configs.

```typescript
import { parseGameConfig } from '@edu-play/validation';

const result = parseGameConfig(configJson);
if (!result.success) {
  throw new Error(JSON.stringify(result.error.format(), null, 2));
}
```

### Theme Configuration

| Schema | Description |
|--------|-------------|
| `themeConfigSchema` | Theme colors and styles |
| `themeDefinitionSchema` | Theme with metadata |
| `hexColorSchema` | Hex color number (0x000000 - 0xFFFFFF) |
| `cssColorSchema` | CSS color string |

### Game State

| Schema | Description |
|--------|-------------|
| `gameStateSchema` | Runtime game state |
| `questionResultSchema` | Question result data |
| `feedbackConfigSchema` | Feedback configuration |
| `animationPresetSchema` | Animation settings |

## Generating JSON Schemas

Generate JSON Schema files for VSCode autocomplete:

```bash
npm run generate-schemas
```

This creates schemas in `docs/schemas/` that can be used with VSCode's JSON validation.

### VSCode Integration

Add to `.vscode/settings.json`:

```json
{
  "json.schemas": [
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
    }
  ]
}
```

Use `game-config.schema.json` for new config authoring so VSCode can select the correct per-template schema by `meta.gameType`. Legacy multiple-choice tooling that still depends on the old base shape can keep referencing `base-game-config.schema.json`.

Now VSCode will provide autocomplete and validation when editing config files!

## Validation Features

### Custom Refinements

Schemas include business logic validation:

- **Exactly one correct answer** per question
- **2-6 choices** per question
- **Semantic version format** for game versions
- **Positive numbers** for time limits and points

### Detailed Error Messages

```typescript
const result = baseGameConfigSchema.safeParse(invalidConfig);
if (!result.success) {
  // Detailed, structured error information
  console.log(result.error.format());
  /*
  {
    meta: {
      totalSteps: { _errors: ['Expected number, received string'] }
    },
    questions: {
      0: {
        choices: { _errors: ['Question must have exactly one correct answer'] }
      }
    }
  }
  */
}
```

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm run test          # Run tests once
npm run test:watch    # Watch mode
```

### Validate Config (CLI)

```bash
npm run validate-config -- path/to/config.json
```

## Benefits

| Benefit | Description |
|---------|-------------|
| **Runtime safety** | Catch invalid configs at load time, not runtime |
| **Type safety** | Single source of truth for TypeScript types |
| **Developer UX** | VSCode autocomplete for JSON configs |
| **Maintainability** | Schema changes automatically update types |
| **CI/CD integration** | Validate configs in automated tests |

## Architecture Integration

This package is the foundation for:

- **Phase 2**: ConfigLoader runtime validation
- **Phase 3**: Manager API contracts
- **Phase 4**: Prefab config validation
- **Phase 5**: AI content generation validation
- **Phase 6**: Developer tooling (CLI, pre-commit hooks)
- **Phase 7**: CI/CD config validation
- **Phase 8**: E2E test helpers

## License

MIT

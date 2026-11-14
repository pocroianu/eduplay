import { describe, expect, it } from 'vitest';
import { buildGeneratedSchemas, buildVSCodeJsonSchemasSnippet } from '../scripts/generate-schemas';

describe('JSON schema generation', () => {
  it('builds per-template game config schemas beyond the legacy base schema', () => {
    const generated = buildGeneratedSchemas();
    const byName = new Map(generated.map((entry) => [entry.name, entry.schema]));

    expect(byName.has('base-game-config')).toBe(true);
    expect(byName.has('game-config.listen-tap')).toBe(true);
    expect(byName.has('game-config.memory')).toBe(true);
    expect(byName.has('game-config')).toBe(true);
    expect(byName.has('activity')).toBe(true);
    expect(byName.has('activity-assets')).toBe(true);

    const listenTapSchema = definitionFor(byName.get('game-config.listen-tap'), 'game-config.listen-tap');
    expect(listenTapSchema?.properties?.meta?.properties?.gameType?.const).toBe('listen-tap');
    expect(listenTapSchema?.properties?.rounds?.minItems).toBe(1);

    const memorySchema = definitionFor(byName.get('game-config.memory'), 'game-config.memory');
    expect(memorySchema?.properties?.meta?.properties?.gameType?.const).toBe('memory');
    expect(memorySchema?.properties?.pairs?.minItems).toBe(2);

    expect(byName.get('game-config')?.oneOf).toEqual(
      expect.arrayContaining([
        { $ref: './game-config.listen-tap.schema.json' },
        { $ref: './game-config.memory.schema.json' }
      ])
    );
  });

  it('prints VSCode json.schemas guidance for repo-level activity content paths', () => {
    const snippet = buildVSCodeJsonSchemasSnippet();

    expect(snippet).toContain('"fileMatch": ["activities/*/activity.json"]');
    expect(snippet).toContain('"fileMatch": ["activities/*/versions/*/config.json"]');
    expect(snippet).toContain('"activities/*/versions/*/strings/en.json"');
    expect(snippet).toContain('"activities/*/versions/*/strings/ro.json"');
    expect(snippet).toContain('"fileMatch": ["activities/*/versions/*/assets.json"]');
    expect(snippet).not.toContain('templates/*/static/configs');
  });
});

function definitionFor(schema: any, name: string): any {
  return schema?.definitions?.[name] ?? schema;
}

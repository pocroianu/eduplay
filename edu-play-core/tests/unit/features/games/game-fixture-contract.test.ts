import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameToHostMessageSchema } from '@edu-play/activity-protocol';
import fixtureContract from '../../../../public/games/mock-game/contract-fixtures.json';

const MOCK_GAME_HTML = join(process.cwd(), 'public/games/mock-game/index.html');

describe('static game fixture protocol contract', () => {
  it('keeps checked-in mock game messages schema-valid', () => {
    for (const message of fixtureContract.gameToHost) {
      expect(gameToHostMessageSchema.parse(message)).toEqual(message);
    }
  });

  it('does not use wildcard postMessage target origins in the mock game fixture', () => {
    const html = readFileSync(MOCK_GAME_HTML, 'utf8');

    expect(html).not.toMatch(/postMessage\s*\([\s\S]*?,\s*['"]\*['"]/);
    expect(html).not.toMatch(/targetOrigin\s*:\s*['"]\*['"]/);
  });
});

import { describe, expect, it } from 'vitest';
import { join, normalize } from 'path';
import { resolveMultipleChoiceGamesPath } from '../extract';

describe('resolveMultipleChoiceGamesPath', () => {
  it('resolves the Activity content root from the ai-content commands directory', () => {
    const commandsDir = join('repo', 'packages', 'ai-content', 'src', 'cli', 'commands');

    expect(normalize(resolveMultipleChoiceGamesPath(commandsDir))).toBe(
      normalize(join('repo', 'activities'))
    );
  });
});

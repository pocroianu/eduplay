import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { filterStudentVisibleGames, isGameVisibleToStudents } from '../game-gate';

const baseGame = {
  game_url: '/games/counting-game/index.html',
};

const listenTapGame = {
  game_url: '/play/activity-listen-tap',
  template: 'listen-tap',
};

const listenTapHostedGame = {
  game_url: 'https://cdn.example.com/games/listen-tap/v2/index.html',
};

describe('feature-flags / game-gate', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('isGameVisibleToStudents', () => {
    it('returns true for games that do not require a flag', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '');
      expect(isGameVisibleToStudents(baseGame)).toBe(true);
    });

    it('returns false for listen-tap Activities when flag is off', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '0');
      expect(isGameVisibleToStudents(listenTapGame)).toBe(false);
      expect(isGameVisibleToStudents(listenTapHostedGame)).toBe(false);
    });

    it('returns true for listen-tap Activities when flag is on', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '1');
      expect(isGameVisibleToStudents(listenTapGame)).toBe(true);
      expect(isGameVisibleToStudents(listenTapHostedGame)).toBe(true);
    });
  });

  describe('filterStudentVisibleGames', () => {
    it('returns all games when no listen-tap entry is present', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '');
      const games = [baseGame, { game_url: '/games/shapes/index.html' }];
      expect(filterStudentVisibleGames(games)).toEqual(games);
    });

    it('strips listen-tap games when flag is off', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '0');
      const games = [baseGame, listenTapGame];
      expect(filterStudentVisibleGames(games)).toEqual([baseGame]);
    });

    it('keeps listen-tap games when flag is on', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '1');
      const games = [baseGame, listenTapGame];
      expect(filterStudentVisibleGames(games)).toEqual(games);
    });
  });
});

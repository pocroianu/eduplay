import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_PROTOCOL_FIXTURES,
  gameCompleteMessageSchema,
  gameToHostMessageSchema,
  hostToGameMessageSchema,
  parseGameToHostMessage,
  parseHostToGameMessage,
} from '@edu-play/activity-protocol';

describe('activity protocol message schemas', () => {
  it('accepts canonical game-to-host fixtures', () => {
    for (const message of ACTIVITY_PROTOCOL_FIXTURES.gameToHost.valid) {
      expect(gameToHostMessageSchema.parse(message)).toEqual(message);
      expect(parseGameToHostMessage(message)).toEqual({
        success: true,
        data: message,
      });
    }
  });

  it('rejects malformed game-to-host payloads without throwing from parser', () => {
    for (const message of ACTIVITY_PROTOCOL_FIXTURES.gameToHost.invalid) {
      expect(gameToHostMessageSchema.safeParse(message).success).toBe(false);

      const result = parseGameToHostMessage(message);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    }
  });

  it('accepts canonical host-to-game fixtures', () => {
    for (const message of ACTIVITY_PROTOCOL_FIXTURES.hostToGame.valid) {
      expect(hostToGameMessageSchema.parse(message)).toEqual(message);
      expect(parseHostToGameMessage(message)).toEqual({
        success: true,
        data: message,
      });
    }
  });

  it('rejects malformed host-to-game payloads without throwing from parser', () => {
    for (const message of ACTIVITY_PROTOCOL_FIXTURES.hostToGame.invalid) {
      expect(hostToGameMessageSchema.safeParse(message).success).toBe(false);

      const result = parseHostToGameMessage(message);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps configUrl out of ACTIVITY_INIT', () => {
    const result = hostToGameMessageSchema.safeParse({
      type: 'ACTIVITY_INIT',
      gameId: 'fruits-01',
      language: 'ro',
      muted: false,
      configUrl: '/api/v1/activities/activity-1/config?versionId=version-1',
    });

    expect(result.success).toBe(false);
  });

  it('keeps GAME_COMPLETE reason optional for legacy bundles but validates it when present', () => {
    expect(
      gameCompleteMessageSchema.parse({
        type: 'GAME_COMPLETE',
        score: 80,
        totalSets: 10,
        timeSpent: 45,
      }),
    ).toEqual({
      type: 'GAME_COMPLETE',
      score: 80,
      totalSets: 10,
      timeSpent: 45,
    });

    expect(
      gameCompleteMessageSchema.parse({
        type: 'GAME_COMPLETE',
        score: 80,
        totalSets: 10,
        timeSpent: 45,
        screenshotDataUrl: 'data:image/jpeg;base64,aGVsbG8=',
      }),
    ).toEqual({
      type: 'GAME_COMPLETE',
      score: 80,
      totalSets: 10,
      timeSpent: 45,
      screenshotDataUrl: 'data:image/jpeg;base64,aGVsbG8=',
    });

    expect(
      gameCompleteMessageSchema.safeParse({
        type: 'GAME_COMPLETE',
        score: 80,
        totalSets: 10,
        timeSpent: 45,
        reason: '',
      }).success,
    ).toBe(false);
  });
});

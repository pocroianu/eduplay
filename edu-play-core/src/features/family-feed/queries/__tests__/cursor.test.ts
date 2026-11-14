import { describe, expect, it } from 'vitest';
import {
  decodeFeedCursor,
  encodeFeedCursor,
  formatArtifactFeedId,
  formatMilestoneFeedId,
  parseFeedItemId,
  translateForArtifactSide,
  translateForMilestoneSide,
} from '../cursor';

const ARTIFACT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STUDENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GAME_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TS = '2026-04-15T00:00:00.000Z';

describe('feed cursor encode/decode', () => {
  it('round-trips an artifact-anchored payload', () => {
    const encoded = encodeFeedCursor({
      ts: TS,
      id: formatArtifactFeedId(ARTIFACT_ID),
    });
    expect(decodeFeedCursor(encoded)).toEqual({
      ts: TS,
      id: formatArtifactFeedId(ARTIFACT_ID),
    });
  });

  it('round-trips a milestone-anchored payload', () => {
    const encoded = encodeFeedCursor({
      ts: TS,
      id: formatMilestoneFeedId(STUDENT_ID, GAME_ID),
    });
    expect(decodeFeedCursor(encoded)).toEqual({
      ts: TS,
      id: formatMilestoneFeedId(STUDENT_ID, GAME_ID),
    });
  });

  it('returns null for garbled input rather than throwing', () => {
    expect(decodeFeedCursor('')).toBeNull();
    expect(decodeFeedCursor('not-base64')).toBeNull();
    // base64url payload that decodes but lacks the `|` separator.
    expect(
      decodeFeedCursor(Buffer.from('only-one-piece').toString('base64url')),
    ).toBeNull();
  });
});

describe('parseFeedItemId', () => {
  it('parses an artifact id', () => {
    expect(parseFeedItemId(formatArtifactFeedId(ARTIFACT_ID))).toEqual({
      kind: 'artifact',
      artifactId: ARTIFACT_ID,
    });
  });

  it('parses a milestone id (preserves both halves of the composite key)', () => {
    expect(parseFeedItemId(formatMilestoneFeedId(STUDENT_ID, GAME_ID))).toEqual({
      kind: 'milestone',
      studentId: STUDENT_ID,
      gameId: GAME_ID,
    });
  });

  it('returns null for unknown prefixes or empty halves', () => {
    expect(parseFeedItemId('user:42')).toBeNull();
    expect(parseFeedItemId('artifact:')).toBeNull();
    // Missing ":" after "milestone:" means no game id half.
    expect(parseFeedItemId(`milestone:${STUDENT_ID}`)).toBeNull();
    // Empty student half.
    expect(parseFeedItemId(`milestone::${GAME_ID}`)).toBeNull();
  });

  it('rejects non-UUID id halves to keep tampered cursors out of .or filters', () => {
    // Reserved PostgREST filter chars in a tampered artifact cursor.
    expect(parseFeedItemId('artifact:foo,bar')).toBeNull();
    expect(parseFeedItemId('artifact:abc)*,reviewed_at.gt.2000')).toBeNull();
    // Plain non-UUID (e.g. truncated or numeric).
    expect(parseFeedItemId('artifact:42')).toBeNull();
    // Milestone with non-UUID student id.
    expect(parseFeedItemId(`milestone:not-a-uuid:${GAME_ID}`)).toBeNull();
    // Milestone with non-UUID game id.
    expect(parseFeedItemId(`milestone:${STUDENT_ID}:not-a-uuid`)).toBeNull();
    // Milestone with reserved filter chars in either half.
    expect(parseFeedItemId(`milestone:${STUDENT_ID}:abc,def`)).toBeNull();
  });
});

describe('translateForArtifactSide', () => {
  it('returns null for a null cursor', () => {
    expect(translateForArtifactSide(null)).toBeNull();
  });

  it('lt-or-id-at-ts when the anchor is itself an artifact', () => {
    expect(
      translateForArtifactSide({
        ts: TS,
        id: formatArtifactFeedId(ARTIFACT_ID),
      }),
    ).toEqual({ mode: 'lt-or-id-at-ts', ts: TS, idAtTs: ARTIFACT_ID });
  });

  it('le-ts when the anchor is on the milestone side (artifact prefix lex-precedes)', () => {
    // Every "artifact:..." at the same ts is lex-less-than any
    // "milestone:..." → all qualify. Strict-less-than expressed via .lte()
    // upper bound on the timestamp.
    expect(
      translateForArtifactSide({
        ts: TS,
        id: formatMilestoneFeedId(STUDENT_ID, GAME_ID),
      }),
    ).toEqual({ mode: 'le-ts', ts: TS });
  });

  it('returns null when the anchor id is unparseable', () => {
    expect(translateForArtifactSide({ ts: TS, id: 'garbled:thing' })).toBeNull();
  });
});

describe('translateForMilestoneSide', () => {
  it('returns null for a null cursor', () => {
    expect(translateForMilestoneSide(null)).toBeNull();
  });

  it('lt-or-id-at-ts when the anchor is itself a milestone', () => {
    expect(
      translateForMilestoneSide({
        ts: TS,
        id: formatMilestoneFeedId(STUDENT_ID, GAME_ID),
      }),
    ).toEqual({
      mode: 'lt-or-id-at-ts',
      ts: TS,
      studentIdAtTs: STUDENT_ID,
      gameIdAtTs: GAME_ID,
    });
  });

  it('lt-ts when the anchor is on the artifact side (milestone prefix lex-exceeds)', () => {
    // Every "milestone:..." at the same ts is lex-greater than the
    // anchor → none qualify; we simply skip the boundary timestamp.
    expect(
      translateForMilestoneSide({
        ts: TS,
        id: formatArtifactFeedId(ARTIFACT_ID),
      }),
    ).toEqual({ mode: 'lt-ts', ts: TS });
  });

  it('returns null when the anchor id is unparseable', () => {
    expect(
      translateForMilestoneSide({ ts: TS, id: 'unrelated' }),
    ).toBeNull();
  });
});

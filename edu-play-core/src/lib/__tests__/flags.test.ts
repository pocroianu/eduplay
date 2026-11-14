import { describe, it, expect } from 'vitest';
import { evaluateFlag } from '../flags';

const userId = '11111111-1111-1111-1111-111111111111';
const otherId = '22222222-2222-2222-2222-222222222222';
const profile = { id: userId, role: 'teacher' };

describe('evaluateFlag', () => {
  it('returns false when disabled and no targeting', () => {
    expect(evaluateFlag({ enabled: false, targeting: {} }, profile)).toBe(false);
  });

  it('returns true when enabled and no targeting', () => {
    expect(evaluateFlag({ enabled: true, targeting: {} }, profile)).toBe(true);
  });

  it('deny short-circuits to false even when enabled', () => {
    expect(
      evaluateFlag({ enabled: true, targeting: { deny: [userId] } }, profile),
    ).toBe(false);
  });

  it('deny wins over allow on the same id', () => {
    expect(
      evaluateFlag(
        { enabled: false, targeting: { allow: [userId], deny: [userId] } },
        profile,
      ),
    ).toBe(false);
  });

  it('allow short-circuits to true even when disabled', () => {
    expect(
      evaluateFlag(
        { enabled: false, targeting: { allow: [userId] } },
        profile,
      ),
    ).toBe(true);
  });

  it('roles whitelist denies non-matching role', () => {
    expect(
      evaluateFlag(
        { enabled: true, targeting: { roles: ['admin'] } },
        profile,
      ),
    ).toBe(false);
  });

  it('roles whitelist accepts matching role and respects enabled', () => {
    expect(
      evaluateFlag(
        { enabled: true, targeting: { roles: ['teacher'] } },
        profile,
      ),
    ).toBe(true);
    expect(
      evaluateFlag(
        { enabled: false, targeting: { roles: ['teacher'] } },
        profile,
      ),
    ).toBe(false);
  });

  it('allow bypasses role whitelist', () => {
    expect(
      evaluateFlag(
        { enabled: false, targeting: { allow: [userId], roles: ['admin'] } },
        profile,
      ),
    ).toBe(true);
  });

  it('non-matching deny does not affect outcome', () => {
    expect(
      evaluateFlag(
        { enabled: true, targeting: { deny: [otherId] } },
        profile,
      ),
    ).toBe(true);
  });
});

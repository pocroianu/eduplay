import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FEATURE_FLAGS, getFlag, getFlagSnapshot, type FeatureFlag } from '../flags';

describe('feature-flags / flags', () => {
  const knownFlag: FeatureFlag = 'listen_tap_audio';

  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('FEATURE_FLAGS catalog', () => {
    it('declares listen_tap_audio as the only v1 flag', () => {
      expect(FEATURE_FLAGS).toEqual(['listen_tap_audio']);
    });
  });

  describe('getFlag', () => {
    it('returns false when the env var is unset', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '');
      expect(getFlag(knownFlag)).toBe(false);
    });

    it('returns false for "0"', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '0');
      expect(getFlag(knownFlag)).toBe(false);
    });

    it('returns false for "false"', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', 'false');
      expect(getFlag(knownFlag)).toBe(false);
    });

    it('returns true for "1"', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '1');
      expect(getFlag(knownFlag)).toBe(true);
    });

    it('returns true for "true" (case-insensitive)', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', 'TRUE');
      expect(getFlag(knownFlag)).toBe(true);
    });

    it('returns true for "on"', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', 'on');
      expect(getFlag(knownFlag)).toBe(true);
    });

    it('returns false for unrecognized truthy strings', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', 'yes');
      expect(getFlag(knownFlag)).toBe(false);
    });

    it('trims whitespace before parsing', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '  1  ');
      expect(getFlag(knownFlag)).toBe(true);
    });
  });

  describe('getFlagSnapshot', () => {
    it('returns false-by-default for every known flag when env is empty', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '');
      const snapshot = getFlagSnapshot();
      for (const name of FEATURE_FLAGS) {
        expect(snapshot[name]).toBe(false);
      }
    });

    it('reflects current env values', () => {
      vi.stubEnv('NEXT_PUBLIC_FEATURE_LISTEN_TAP_AUDIO', '1');
      const snapshot = getFlagSnapshot();
      expect(snapshot.listen_tap_audio).toBe(true);
    });

    it('returns a snapshot keyed by every declared flag', () => {
      const snapshot = getFlagSnapshot();
      expect(Object.keys(snapshot).sort()).toEqual([...FEATURE_FLAGS].sort());
    });
  });
});

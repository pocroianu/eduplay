import { describe, expect, it } from 'vitest';
import { resolveConsentGate } from '../consent-gate';
import type { ConsentMap } from '../../types';

describe('resolveConsentGate', () => {
  it('returns undefined when the type has no requiredConsent (no gate)', () => {
    expect(resolveConsentGate(undefined, {})).toBeUndefined();
    expect(resolveConsentGate(undefined, { audio_recording: true })).toBeUndefined();
  });

  it('returns allowed when the required consent is granted', () => {
    expect(
      resolveConsentGate('audio_recording', { audio_recording: true }),
    ).toEqual({ allowed: true });
  });

  it('returns consent_required denial when the consent map is empty', () => {
    expect(resolveConsentGate('audio_recording', {})).toEqual({
      allowed: false,
      reason: 'consent_required',
    });
  });

  it('returns consent_required denial when the consent flag is explicitly false', () => {
    const consents: ConsentMap = { audio_recording: false };
    expect(resolveConsentGate('audio_recording', consents)).toEqual({
      allowed: false,
      reason: 'consent_required',
    });
  });

  it('treats non-boolean truthy values as not granted (only `true` counts)', () => {
    const consents = { audio_recording: 'yes' } as unknown as ConsentMap;
    expect(resolveConsentGate('audio_recording', consents)).toEqual({
      allowed: false,
      reason: 'consent_required',
    });
  });

  it('does not require unrelated keys', () => {
    const consents: ConsentMap = { photo_capture: true };
    expect(
      resolveConsentGate('audio_recording', consents),
    ).toEqual({ allowed: false, reason: 'consent_required' });
    expect(
      resolveConsentGate('photo_capture', consents),
    ).toEqual({ allowed: true });
  });
});

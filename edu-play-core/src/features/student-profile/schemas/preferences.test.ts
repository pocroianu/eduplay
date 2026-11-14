import { describe, it, expect } from 'vitest';
import { preferencesSchema, DEFAULT_PREFERENCES } from './preferences.schema';
import { changePinSchema } from './pin.schema';
import { avatarPresetSchema, AVATAR_PRESETS } from './avatar.schema';

describe('preferencesSchema', () => {
  it('accepts a fully-populated preferences object', () => {
    const result = preferencesSchema.safeParse({
      sound_enabled: false,
      reduced_motion: true,
      theme: 'dark',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid theme values', () => {
    const result = preferencesSchema.safeParse({
      sound_enabled: true,
      reduced_motion: false,
      theme: 'sepia',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-boolean toggles', () => {
    const result = preferencesSchema.safeParse({
      sound_enabled: 'yes',
      reduced_motion: false,
      theme: 'auto',
    });
    expect(result.success).toBe(false);
  });

  it('exposes a usable default object', () => {
    expect(preferencesSchema.parse(DEFAULT_PREFERENCES)).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('changePinSchema', () => {
  it('accepts a valid PIN change request', () => {
    const result = changePinSchema.safeParse({
      currentPin: '1234',
      newPin: '5678',
      confirmPin: '5678',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when newPin and confirmPin differ', () => {
    const result = changePinSchema.safeParse({
      currentPin: '1234',
      newPin: '5678',
      confirmPin: '5679',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === 'confirmPin');
      expect(issue?.message).toContain('Confirmarea');
    }
  });

  it('rejects when newPin equals currentPin', () => {
    const result = changePinSchema.safeParse({
      currentPin: '1234',
      newPin: '1234',
      confirmPin: '1234',
    });
    expect(result.success).toBe(false);
  });

  it('rejects PINs that contain non-digit characters', () => {
    const result = changePinSchema.safeParse({
      currentPin: '12a4',
      newPin: '5678',
      confirmPin: '5678',
    });
    expect(result.success).toBe(false);
  });

  it('rejects PINs that are not exactly 4 characters', () => {
    const result = changePinSchema.safeParse({
      currentPin: '123',
      newPin: '56789',
      confirmPin: '56789',
    });
    expect(result.success).toBe(false);
  });
});

describe('avatarPresetSchema', () => {
  it('exposes 12 preset URLs', () => {
    expect(AVATAR_PRESETS).toHaveLength(12);
    AVATAR_PRESETS.forEach((url) => {
      expect(url).toMatch(/^\/avatars\/preset-\d{2}\.svg$/);
    });
  });

  it('accepts each declared preset', () => {
    AVATAR_PRESETS.forEach((preset) => {
      expect(avatarPresetSchema.safeParse(preset).success).toBe(true);
    });
  });

  it('rejects URLs outside the preset list', () => {
    expect(avatarPresetSchema.safeParse('/uploads/custom.png').success).toBe(false);
    expect(avatarPresetSchema.safeParse('https://evil.example/x.png').success).toBe(false);
  });
});

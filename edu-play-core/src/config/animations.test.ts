import { describe, expect, it } from 'vitest';
import {
  float,
  fadeInUp,
  motionPreset,
  motionPresets,
  reducedMotionPresets,
} from './animations';

describe('motionPreset', () => {
  it('returns the full preset when motion is allowed', () => {
    expect(motionPreset('float', false)).toBe(float);
    expect(motionPreset('fadeInUp', false)).toBe(fadeInUp);
  });

  it('removes the float loop when motion is reduced', () => {
    expect(JSON.stringify(motionPreset('float', true))).not.toContain('Infinity');
    expect(motionPreset('float', true).animate).toEqual({});
  });

  it('replaces translate entrances with an opacity fade', () => {
    const entrance = motionPreset('fadeInUp', true);
    expect(entrance.initial).toEqual({ opacity: 0 });
    expect(entrance.animate).toMatchObject({ opacity: 1 });
  });

  it('defines a reduced variant for every preset', () => {
    expect(Object.keys(reducedMotionPresets).sort()).toEqual(Object.keys(motionPresets).sort());
  });
});

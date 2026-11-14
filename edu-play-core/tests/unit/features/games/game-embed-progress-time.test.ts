import { describe, expect, it } from 'vitest';
import { getProgressTimeDelta } from '@/features/games/components/GameEmbed';

describe('GameEmbed progress time accounting', () => {
  it('sends only the elapsed delta because the progress API accumulates timeSpent', () => {
    expect(getProgressTimeDelta(0, 10)).toBe(10);
    expect(getProgressTimeDelta(10, 20)).toBe(10);
    expect(getProgressTimeDelta(20, 30)).toBe(10);
  });

  it('clamps backwards or duplicate timer reads to zero', () => {
    expect(getProgressTimeDelta(20, 20)).toBe(0);
    expect(getProgressTimeDelta(20, 15)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { calculateActivityStreak } from './activity-streak';

describe('Activity streak', () => {
  it('uses Bucharest midnight rather than UTC midnight', () => {
    expect(calculateActivityStreak(['2026-11-15', '2026-11-14'], new Date('2026-11-14T22:05:00Z'))).toBe(2);
  });
  it('allows yesterday, ignores duplicate, future and invalid days, and stops at a gap', () => {
    expect(calculateActivityStreak(['2026-11-14', '2026-11-14', '2026-11-13', '2026-11-11', '2026-11-16', 'bad'], new Date('2026-11-15T12:00:00Z'))).toBe(2);
    expect(calculateActivityStreak(['2026-11-13'], new Date('2026-11-15T12:00:00Z'))).toBe(0);
    expect(calculateActivityStreak([], new Date('2026-11-15T12:00:00Z'))).toBe(0);
  });
  it.each([
    ['2026-03-30', '2026-03-29', '2026-03-28'],
    ['2026-10-26', '2026-10-25', '2026-10-24'],
  ])('walks calendar days across daylight-saving changes: %s', (today, yesterday, before) => {
    expect(calculateActivityStreak([today, yesterday, before], new Date(`${today}T12:00:00Z`))).toBe(3);
  });
});

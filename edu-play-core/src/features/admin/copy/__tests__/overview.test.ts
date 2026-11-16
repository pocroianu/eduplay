import { describe, it, expect } from 'vitest';
import {
  getAdminGreeting,
  ADMIN_OVERVIEW_HEADER,
  ADMIN_OVERVIEW_PANELS,
} from '../overview';

function at(hour: number, minute = 0): Date {
  const d = new Date(2026, 3, 26, hour, minute, 0, 0);
  return d;
}

describe('getAdminGreeting', () => {
  it.each([
    [5, 'Bună dimineața'],
    [11, 'Bună dimineața'],
    [12, 'Bună ziua'],
    [17, 'Bună ziua'],
    [18, 'Bună seara'],
    [22, 'Bună seara'],
    [23, 'Bună noaptea'],
    [4, 'Bună noaptea'],
  ] as const)('returns the right greeting for %i:00', (hour, expected) => {
    expect(getAdminGreeting(at(hour))).toBe(expected);
  });
});

describe('ADMIN_OVERVIEW_HEADER.greeting', () => {
  it('interpolates the actor name with the chosen greeting', () => {
    const sentence = ADMIN_OVERVIEW_HEADER.greeting('Bună ziua', 'Andrei');
    expect(sentence).toBe('Bună ziua, Andrei');
  });
});

describe('ADMIN_OVERVIEW_PANELS.recentReleases.actionLabels', () => {
  it('maps every feature_flag_events.action value to a Romanian label', () => {
    const labels = ADMIN_OVERVIEW_PANELS.recentReleases.actionLabels;
    // These keys must stay in sync with feature_flag_events.action CHECK
    // constraint in `20261116225053_baseline.sql`.
    expect(Object.keys(labels).sort()).toEqual(
      [
        'created',
        'deleted',
        'description_changed',
        'disabled',
        'enabled',
        'targeting_changed',
      ].sort(),
    );
  });
});

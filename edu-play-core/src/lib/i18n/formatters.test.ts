import { describe, expect, it, vi } from 'vitest';
import {
  formatActivityDayGroupLabel,
  formatDateShort,
  formatMonthYear,
  formatRecentActivityDateTime,
  formatTime,
} from './formatters';

describe('i18n formatters', () => {
  it('formats activity day group labels for today, yesterday, recent days, and old months', () => {
    const now = new Date('2026-05-28T12:00:00.000Z');

    expect(formatActivityDayGroupLabel('2026-05-28T06:00:00.000Z', now)).toBe('Azi');
    expect(formatActivityDayGroupLabel('2026-05-27T06:00:00.000Z', now)).toBe('Ieri');
    expect(formatActivityDayGroupLabel('2026-05-24T06:00:00.000Z', now)).toBe('Acum 4 zile');
    expect(formatActivityDayGroupLabel('2026-04-01T06:00:00.000Z', now)).toBe('aprilie 2026');
  });

  it('formats recent activity timestamps with Romanian relative day labels', () => {
    const now = new Date('2026-05-28T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);

    expect(formatRecentActivityDateTime('2026-05-28T09:30:00.000Z')).toBe(
      `Azi, ${formatTime('2026-05-28T09:30:00.000Z')}`,
    );
    expect(formatRecentActivityDateTime('2026-05-27T09:30:00.000Z')).toBe(
      `Ieri, ${formatTime('2026-05-27T09:30:00.000Z')}`,
    );
    expect(formatRecentActivityDateTime('2026-05-20T09:30:00.000Z')).toBe(
      formatDateShort('2026-05-20T09:30:00.000Z'),
    );

    vi.useRealTimers();
  });

  it('formats month and year in Romanian', () => {
    expect(formatMonthYear('2026-05-15T12:00:00.000Z')).toBe('mai 2026');
  });
});

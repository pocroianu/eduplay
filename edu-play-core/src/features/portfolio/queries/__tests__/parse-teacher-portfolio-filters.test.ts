import { describe, expect, it } from 'vitest';
import {
  filtersToQueryOptions,
  parseTeacherPortfolioFilters,
} from '../parse-teacher-portfolio-filters';

const VALID_UUID = '11111111-1111-1111-1111-111111111111';

describe('parseTeacherPortfolioFilters', () => {
  it('returns nulls for an empty record', () => {
    expect(parseTeacherPortfolioFilters({})).toEqual({
      classId: null,
      studentId: null,
      from: null,
      to: null,
    });
  });

  it('coerces empty strings and whitespace to null', () => {
    expect(
      parseTeacherPortfolioFilters({ classId: '', studentId: '   ' }),
    ).toEqual({ classId: null, studentId: null, from: null, to: null });
  });

  it('keeps valid UUIDs and date strings', () => {
    expect(
      parseTeacherPortfolioFilters({
        classId: VALID_UUID,
        studentId: VALID_UUID,
        from: '2026-04-01',
        to: '2026-04-30',
      }),
    ).toEqual({
      classId: VALID_UUID,
      studentId: VALID_UUID,
      from: '2026-04-01',
      to: '2026-04-30',
    });
  });

  it('drops malformed UUIDs and dates rather than throwing', () => {
    expect(
      parseTeacherPortfolioFilters({
        classId: 'not-a-uuid',
        studentId: '12345',
        from: '04/01/2026',
        to: '2026-13-99',
      }),
    ).toEqual({ classId: null, studentId: null, from: null, to: null });
  });

  it('drops shape-valid but impossible calendar dates (Feb 30, month 13)', () => {
    expect(
      parseTeacherPortfolioFilters({ from: '2026-02-30', to: '2026-13-01' }),
    ).toEqual({ classId: null, studentId: null, from: null, to: null });
  });

  it('keeps month/day boundaries that resolve to a real day', () => {
    expect(
      parseTeacherPortfolioFilters({ from: '2024-02-29', to: '2026-12-31' }),
    ).toEqual({
      classId: null,
      studentId: null,
      from: '2024-02-29',
      to: '2026-12-31',
    });
  });
});

describe('filtersToQueryOptions', () => {
  it('returns an empty options object when nothing is set', () => {
    expect(
      filtersToQueryOptions({
        classId: null,
        studentId: null,
        from: null,
        to: null,
      }),
    ).toEqual({});
  });

  it('expands date bounds to full-day ISO timestamps in Europe/Bucharest (EEST, summer)', () => {
    // April is fully inside EEST (UTC+3): 00:00 local = 21:00 UTC the day before;
    // 23:59:59.999 local = 20:59:59.999 UTC the same day.
    expect(
      filtersToQueryOptions({
        classId: null,
        studentId: null,
        from: '2026-04-01',
        to: '2026-04-30',
      }),
    ).toEqual({
      createdAfter: '2026-03-31T21:00:00.000Z',
      createdBefore: '2026-04-30T20:59:59.999Z',
    });
  });

  it('expands date bounds in Europe/Bucharest during EET (winter, UTC+2)', () => {
    // January is fully inside EET (UTC+2): 00:00 local = 22:00 UTC the day before;
    // 23:59:59.999 local = 21:59:59.999 UTC the same day.
    expect(
      filtersToQueryOptions({
        classId: null,
        studentId: null,
        from: '2026-01-15',
        to: '2026-01-15',
      }),
    ).toEqual({
      createdAfter: '2026-01-14T22:00:00.000Z',
      createdBefore: '2026-01-15T21:59:59.999Z',
    });
  });

  it('handles the spring-forward DST transition day (EET → EEST)', () => {
    // Romania DST in 2026: forward at 03:00 local Sunday 2026-03-29.
    // Before transition (00:00 local) → still EET (UTC+2) → 22:00 UTC the day before.
    // End of day (23:59:59.999 local) → EEST (UTC+3) → 20:59:59.999 UTC same day.
    expect(
      filtersToQueryOptions({
        classId: null,
        studentId: null,
        from: '2026-03-29',
        to: '2026-03-29',
      }),
    ).toEqual({
      createdAfter: '2026-03-28T22:00:00.000Z',
      createdBefore: '2026-03-29T20:59:59.999Z',
    });
  });

  it('handles the fall-back DST transition day (EEST → EET)', () => {
    // Romania DST in 2026: back at 04:00 local → 03:00 local Sunday 2026-10-25.
    // 00:00 local → still EEST (UTC+3) → 21:00 UTC the day before.
    // 23:59:59.999 local → EET (UTC+2) → 21:59:59.999 UTC same day.
    expect(
      filtersToQueryOptions({
        classId: null,
        studentId: null,
        from: '2026-10-25',
        to: '2026-10-25',
      }),
    ).toEqual({
      createdAfter: '2026-10-24T21:00:00.000Z',
      createdBefore: '2026-10-25T21:59:59.999Z',
    });
  });

  it('forwards UUID filters verbatim', () => {
    expect(
      filtersToQueryOptions({
        classId: VALID_UUID,
        studentId: VALID_UUID,
        from: null,
        to: null,
      }),
    ).toEqual({ classId: VALID_UUID, studentId: VALID_UUID });
  });
});

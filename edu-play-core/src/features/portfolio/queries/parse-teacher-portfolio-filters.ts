import type { GetDraftArtifactsOptions } from './get-draft-artifacts-for-teacher';

/**
 * EduPlay is a Romania-only product, so date filters from `<input type="date">`
 * are interpreted as calendar days in `Europe/Bucharest` (EET/EEST, DST-aware).
 */
const APP_TIMEZONE = 'Europe/Bucharest';

/**
 * Search params accepted by `/teacher/portfolio`. Mirrors the keys emitted
 * by the filter `<form method="GET">`.
 */
export interface TeacherPortfolioRawFilters {
  classId?: string;
  studentId?: string;
  /** `YYYY-MM-DD` from `<input type="date">`. */
  from?: string;
  /** `YYYY-MM-DD` from `<input type="date">`. */
  to?: string;
}

export interface TeacherPortfolioFilterSet {
  classId: string | null;
  studentId: string | null;
  from: string | null;
  to: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function safeUuid(value: string | undefined): string | null {
  const v = emptyToNull(value);
  if (v === null) return null;
  return UUID_RE.test(v) ? v : null;
}

function safeDate(value: string | undefined): string | null {
  const v = emptyToNull(value);
  if (v === null) return null;
  if (!DATE_RE.test(v)) return null;
  // Reject impossible calendar dates (e.g. 2026-13-99, 2026-02-30) so that
  // a hand-edited URL falls back to the unfiltered page instead of leaking
  // an invalid timestamp into Supabase and triggering a 500.
  const [y, m, d] = v.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (
    utc.getUTCFullYear() !== y ||
    utc.getUTCMonth() !== m - 1 ||
    utc.getUTCDate() !== d
  ) {
    return null;
  }
  return v;
}

/**
 * Parses raw search-param strings into a normalized filter set, dropping
 * malformed values rather than throwing so that hand-edited URLs still
 * resolve to a valid (unfiltered) page.
 */
export function parseTeacherPortfolioFilters(
  raw: TeacherPortfolioRawFilters,
): TeacherPortfolioFilterSet {
  return {
    classId: safeUuid(raw.classId),
    studentId: safeUuid(raw.studentId),
    from: safeDate(raw.from),
    to: safeDate(raw.to),
  };
}

/**
 * Returns the offset (in milliseconds) that `timeZone` is from UTC at `instant`.
 * Positive for east of UTC. Used to convert a wall-clock time in `timeZone`
 * to the equivalent UTC instant in a DST-aware way.
 */
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    year: 'numeric',
  }).formatToParts(instant);
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  // `shortOffset` emits forms like `GMT`, `GMT+2`, `GMT+5:30`, `GMT-4`.
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(tzName);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number.parseInt(match[2], 10);
  const minutes = match[3] ? Number.parseInt(match[3], 10) : 0;
  return sign * (hours * 60 + minutes) * 60 * 1000;
}

/**
 * Converts a `YYYY-MM-DD` calendar day plus a wall-clock time in `timeZone`
 * to the equivalent UTC ISO timestamp. DST-aware: re-evaluates the offset
 * using the candidate UTC instant, so a "23:59:59 local" bound on a
 * spring-forward day still resolves to the post-transition offset.
 */
function localWallClockToUtcIso(
  yyyymmdd: string,
  hours: number,
  minutes: number,
  seconds: number,
  millis: number,
  timeZone: string,
): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hours, minutes, seconds, millis);
  const offsetMs = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offsetMs).toISOString();
}

/**
 * Translates a normalized filter set into the `GetDraftArtifactsOptions`
 * accepted by the Phase 1B query, expanding `YYYY-MM-DD` boundaries into
 * full-day ISO timestamps so partial-day matches are inclusive.
 *
 * Date inputs come from `<input type="date">`, which represents a calendar
 * day in the user's local timezone. EduPlay treats `Europe/Bucharest` as the
 * canonical app timezone, so a "from = 2026-04-01" filter expands to
 * "2026-04-01 00:00 EET/EEST" and a "to = 2026-04-30" filter expands to
 * "2026-04-30 23:59:59.999 EET/EEST" — both converted to UTC for Supabase.
 */
export function filtersToQueryOptions(
  filters: TeacherPortfolioFilterSet,
): GetDraftArtifactsOptions {
  const options: GetDraftArtifactsOptions = {};
  if (filters.classId) options.classId = filters.classId;
  if (filters.studentId) options.studentId = filters.studentId;
  if (filters.from) {
    options.createdAfter = localWallClockToUtcIso(
      filters.from,
      0,
      0,
      0,
      0,
      APP_TIMEZONE,
    );
  }
  if (filters.to) {
    options.createdBefore = localWallClockToUtcIso(
      filters.to,
      23,
      59,
      59,
      999,
      APP_TIMEZONE,
    );
  }
  return options;
}

/**
 * Centralized date/time/number formatting for EduPlay.
 *
 * All locale-aware formatting should go through these helpers
 * instead of calling .toLocaleDateString() directly in components.
 * This ensures consistent Romanian formatting across the platform.
 */

export const DEFAULT_LOCALE = 'ro-RO';

function localeOrDefault(locale?: string): string {
  return locale || DEFAULT_LOCALE;
}

function toDate(date: Date | string): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// --- Date Formatting ---

/** "14 mar. 2026" */
export function formatDate(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(localeOrDefault(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "14 martie 2026" */
export function formatDateLong(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(localeOrDefault(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "14 mar." — day + short month, no year */
export function formatDateShort(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(localeOrDefault(locale), {
    day: 'numeric',
    month: 'short',
  });
}

/** "22 mai" / "May 22" — day + long month, no year */
export function formatMonthDayLong(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(localeOrDefault(locale), {
    day: 'numeric',
    month: 'long',
  });
}

/** "vineri, 22 mai" / "Friday, May 22" */
export function formatWeekdayMonthDay(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(localeOrDefault(locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** "lun" — short weekday name */
export function formatWeekday(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d
    .toLocaleDateString(localeOrDefault(locale), { weekday: 'short' })
    .replace('.', '');
}

/** "martie 2026" */
export function formatMonthYear(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(localeOrDefault(locale), {
    month: 'long',
    year: 'numeric',
  });
}

/** "Azi" / "Ieri" / "Acum 4 zile" / "martie 2026" */
export function formatActivityDayGroupLabel(
  date: Date | string,
  now: Date = new Date(),
  locale?: string,
): string {
  const d = toDate(date);
  const todayStart = startOfLocalDay(now);
  const entryStart = startOfLocalDay(d);
  const diffDays = Math.floor((todayStart.getTime() - entryStart.getTime()) / 86_400_000);

  if (diffDays <= 0) return 'Azi';
  if (diffDays === 1) return 'Ieri';
  if (diffDays <= 30) return `Acum ${diffDays} zile`;
  return formatMonthYear(d, locale);
}

/** "Azi, 14:30" / "Ieri, 14:30" / "22 mai" */
export function formatRecentActivityDateTime(date: Date | string, locale?: string): string {
  const d = toDate(date);
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  const entryStart = startOfLocalDay(d);
  const timeLabel = formatTime(d, locale);

  if (entryStart.getTime() === todayStart.getTime()) {
    return `Azi, ${timeLabel}`;
  }

  if (entryStart.getTime() === yesterdayStart.getTime()) {
    return `Ieri, ${timeLabel}`;
  }

  return formatDateShort(d, locale);
}

// --- Time Formatting ---

/** "14:30" */
export function formatTime(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleTimeString(localeOrDefault(locale), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "14 martie 2026, 14:30" */
export function formatDateTime(date: Date | string, locale?: string): string {
  const d = toDate(date);
  return d.toLocaleDateString(localeOrDefault(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "2:30" — duration from seconds (mm:ss format) */
export function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** "Acum 5 minute" / "Acum 2 ore" / "Ieri" — relative time in Romanian */
export function formatRelativeTime(date: Date | string, locale?: string): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'Acum';
  if (diffMinutes < 60) return `Acum ${diffMinutes} ${diffMinutes === 1 ? 'minut' : 'minute'}`;
  if (diffHours < 24) return `Acum ${diffHours} ${diffHours === 1 ? 'oră' : 'ore'}`;
  if (diffDays === 1) return 'Ieri';
  if (diffDays < 7) return `Acum ${diffDays} zile`;
  return formatDate(d, locale);
}

// --- Number Formatting ---

/** "1.234" — formatted with locale separators */
export function formatNumber(value: number, locale?: string): string {
  return value.toLocaleString(localeOrDefault(locale));
}

/** "85%" */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** "4,5" — one decimal place */
export function formatScore(value: number, locale?: string): string {
  return (Math.round(value * 10) / 10).toLocaleString(localeOrDefault(locale));
}

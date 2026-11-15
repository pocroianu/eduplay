const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit',
});
const DAY = 86_400_000;

/** Dates are persisted Bucharest calendar days, not timestamps or feed items. */
export function calculateActivityStreak(activeDays: readonly string[], now: Date): number {
  const parts = dayFormatter.formatToParts(now);
  function part(type: Intl.DateTimeFormatPartTypes): string {
    return parts.find(entry => entry.type === type)!.value;
  }
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const days = new Set(activeDays.filter(day => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const time = Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === day;
  }));
  // UTC arithmetic here walks date labels; it does not interpret local instants.
  let cursor = Date.parse(`${today}T00:00:00Z`);
  if (!days.has(today)) cursor -= DAY;
  let streak = 0;
  while (days.has(new Date(cursor).toISOString().slice(0, 10))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

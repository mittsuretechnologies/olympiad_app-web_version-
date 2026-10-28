// Coin "days" are Asia/Kolkata calendar days, computed on the server only —
// a phone's clock (or its time zone) never decides whether a streak is alive.

const IST_OFFSET_MS = 330 * 60 * 1000;

// "YYYY-MM-DD" for the IST calendar day containing `d`.
export function istDateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Whole calendar days from `a` to `b` (both "YYYY-MM-DD"); 1 = the next day.
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// The UTC instant at which the IST day `dateKey` began.
export function istDayStart(dateKey: string = istDateKey()): Date {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) - IST_OFFSET_MS);
}

// "YYYY-Www" (ISO week) for the IST day containing `d`.
export function istWeekKey(d: Date = new Date()): string {
  const t = new Date(Date.parse(`${istDateKey(d)}T00:00:00Z`));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);              // Thursday of this ISO week
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function periodKeyFor(frequency: string, d: Date = new Date()): string {
  if (frequency === 'WEEKLY') return istWeekKey(d);
  if (frequency === 'ONCE') return 'ONCE';
  return istDateKey(d);
}

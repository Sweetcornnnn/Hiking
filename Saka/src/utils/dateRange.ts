export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isISODate(s: string | null | undefined): s is string {
  if (!s || !ISO_DATE.test(s)) return false;
  const date = new Date(`${s}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === s;
}

/** Inclusive list of YYYY-MM-DD strings from `start` through `end` (end defaults to start). */
export function inclusiveDates(start: string, end?: string | null): string[] {
  if (!isISODate(start)) return [];
  const finish = effectiveEnd(start, end);
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${finish}T00:00:00.000Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return [];
  const out: string[] = [];
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Inclusive membership check. Null/undefined end → single-day. */
export function dateInRange(date: string, start: string, end?: string | null): boolean {
  if (!isISODate(date) || !isISODate(start)) return false;
  const finish = effectiveEnd(start, end);
  return date >= start && date <= finish;
}

/** Last day of the range. */
export function effectiveEnd(start: string, end?: string | null): string {
  if (!isISODate(start)) return start;
  return isISODate(end) && end >= start ? end : start;
}

export function formatRangeShort(start: string, end?: string | null): string {
  const finish = effectiveEnd(start, end);
  if (!isISODate(start)) return start;
  const fmt = (s: string, includeYear: boolean) => {
    const [year, month, day] = s.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(includeYear ? { year: 'numeric' as const } : {}),
    });
  };
  if (finish === start) return fmt(start, true);
  const yearsDiffer = start.slice(0, 4) !== finish.slice(0, 4);
  return `${fmt(start, yearsDiffer)} – ${fmt(finish, true)}`;
}
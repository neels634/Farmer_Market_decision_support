// Date helpers. Dates are handled as YYYY-MM-DD strings in India Standard Time
// so that "today" matches the farmer's calendar regardless of server timezone.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function dateOnly(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function monthIndex(date: string): number {
  return Number(date.slice(5, 7)) - 1;
}

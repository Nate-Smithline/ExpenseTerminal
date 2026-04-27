/** Calendar helpers in America/New_York (US quarterly reminder schedule). */

export function calendarDateInTimeZone(d: Date, timeZone: string): string {
  const y = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(d);
  const m = new Intl.DateTimeFormat("en-US", { timeZone, month: "2-digit" }).format(d);
  const day = new Intl.DateTimeFormat("en-US", { timeZone, day: "2-digit" }).format(d);
  return `${y}-${m}-${day}`;
}

export function isQuarterlyEstimatedTaxReminderDayNY(
  now: Date = new Date(),
  timeZone = "America/New_York"
): boolean {
  const month = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone, month: "numeric" }).format(now),
    10
  );
  const day = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric" }).format(now),
    10
  );
  return (
    (month === 3 && day === 1) ||
    (month === 5 && day === 1) ||
    (month === 8 && day === 1) ||
    (month === 12 && day === 1)
  );
}

export function sameCalendarDateInNY(a: Date, b: Date, timeZone = "America/New_York"): boolean {
  return calendarDateInTimeZone(a, timeZone) === calendarDateInTimeZone(b, timeZone);
}

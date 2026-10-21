// One business timezone for API rules and browser input/display, independent of host TZ.
export const BUSINESS_TIME_ZONE = "Asia/Taipei";

export function businessToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

// Prisma represents PostgreSQL DATE as a UTC-midnight Date carrier, not an instant.
export function dateOnlyToDb(value: string): Date {
  if (!isDateOnly(value)) throw new RangeError("Invalid date-only value");
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateOnlyFromDb(value: Date): string {
  return value.toISOString().slice(0, 10);
}

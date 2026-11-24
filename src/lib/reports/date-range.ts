export type DhakaDateRange = {
  from: string;
  to: string;
  startsAt: Date;
  endsBefore: Date;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

function isCalendarDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day;
}

export function parseDhakaDate(value: string) {
  if (!isCalendarDate(value)) return null;
  return new Date(`${value}T12:00:00.000+06:00`);
}

function shiftCalendarDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

export function getDhakaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function resolveDhakaDateRange(
  fromValue: string | undefined,
  toValue: string | undefined,
  defaultFrom: string,
  defaultTo: string,
): { range: DhakaDateRange; error?: string } {
  let from = fromValue || defaultFrom;
  let to = toValue || defaultTo;
  let error: string | undefined;

  if (!isCalendarDate(from) || !isCalendarDate(to)) {
    from = defaultFrom;
    to = defaultTo;
    error = "তারিখের filter সঠিক নয়; default range দেখানো হচ্ছে।";
  } else if (from > to) {
    from = defaultFrom;
    to = defaultTo;
    error = "শুরুর তারিখ শেষ তারিখের পরে হতে পারে না; default range দেখানো হচ্ছে।";
  } else {
    const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
    const [toYear, toMonth, toDay] = to.split("-").map(Number);
    const days = (Date.UTC(toYear, toMonth - 1, toDay) -
      Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000 + 1;
    if (days > MAX_RANGE_DAYS) {
      from = defaultFrom;
      to = defaultTo;
      error = "একবারে সর্বোচ্চ ৩৬৬ দিনের রিপোর্ট দেখা যাবে; default range দেখানো হচ্ছে।";
    }
  }

  return {
    range: {
      from,
      to,
      startsAt: new Date(`${from}T00:00:00.000+06:00`),
      endsBefore: new Date(`${shiftCalendarDate(to, 1)}T00:00:00.000+06:00`),
    },
    ...(error ? { error } : {}),
  };
}

export function getPreviousDhakaDate(date: string) {
  return shiftCalendarDate(date, -1);
}

export function getNextDhakaDate(date: string) {
  return shiftCalendarDate(date, 1);
}

export const DEFAULT_BROKER_TIME_ZONE = "Asia/Karachi";

export function getResolvedTimeZone(timeZone?: string | null) {
  if (timeZone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
      return timeZone;
    } catch {
      // Fall through to browser or default timezone.
    }
  }

  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_BROKER_TIME_ZONE;
  } catch {
    return DEFAULT_BROKER_TIME_ZONE;
  }
}

function getBrokerDateParts(date: Date, timeZone?: string | null) {
  const resolvedTimeZone = getResolvedTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolvedTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;

  return {
    year: part("year") ?? "",
    month: part("month") ?? "",
    day: part("day") ?? "",
    hour: part("hour") ?? "",
    minute: part("minute") ?? ""
  };
}

function getWallTimeMs(parts: { year: string; month: string; day: string; hour: string; minute: string }, second = 0) {
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    second
  );
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatBrokerDateTime(
  value: string | Date,
  timeZone?: string | null,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short"
  }
) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-PK", {
    timeZone: getResolvedTimeZone(timeZone),
    ...options
  }).format(date);
}

export function toBrokerDatetimeLocal(value: string | null | undefined, timeZone?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = getBrokerDateParts(date, timeZone);
  if (!parts.year || !parts.month || !parts.day || !parts.hour || !parts.minute) {
    return "";
  }

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromBrokerDatetimeLocal(value: string, timeZone?: string | null) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  const desiredWallTime = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  let utcDate = new Date(desiredWallTime);

  for (let index = 0; index < 3; index += 1) {
    const currentWallTime = getWallTimeMs(getBrokerDateParts(utcDate, timeZone), utcDate.getUTCSeconds());
    const delta = desiredWallTime - currentWallTime;
    if (delta === 0) {
      break;
    }
    utcDate = new Date(utcDate.getTime() + delta);
  }

  return utcDate.toISOString();
}

export function getBrokerDayRange(offsetDays = 0, durationDays = 0, timeZone?: string | null) {
  const today = getBrokerDateParts(new Date(), timeZone);
  const startDate = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day) + offsetDays));
  const endDate = new Date(Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day) + offsetDays + durationDays));

  const startYear = startDate.getUTCFullYear();
  const startMonth = pad(startDate.getUTCMonth() + 1);
  const startDay = pad(startDate.getUTCDate());
  const endYear = endDate.getUTCFullYear();
  const endMonth = pad(endDate.getUTCMonth() + 1);
  const endDay = pad(endDate.getUTCDate());

  return {
    from: fromBrokerDatetimeLocal(`${startYear}-${startMonth}-${startDay}T00:00`, timeZone),
    to: fromBrokerDatetimeLocal(`${endYear}-${endMonth}-${endDay}T23:59:59`, timeZone)
  };
}

export function getBrokerDateKey(value: string | Date, timeZone?: string | null) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = getBrokerDateParts(date, timeZone);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

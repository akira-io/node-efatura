export interface ParsedEventDateTime {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

const EVENT_DATE_TIME_PATTERN =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.\d+)?(?<timezone>Z|[+-]\d{2}:\d{2})?$/;

export function parseEventDateTime(value: string): ParsedEventDateTime | null {
  const match = EVENT_DATE_TIME_PATTERN.exec(value);

  if (!match?.groups) {
    return null;
  }

  const { year, month, day, hour, minute, second, timezone } = match.groups;

  if (
    !year ||
    !month ||
    !day ||
    !hour ||
    !minute ||
    !second ||
    !isValidEventDate(Number(year), Number(month), Number(day)) ||
    !isValidEventTime(Number(hour), Number(minute), Number(second)) ||
    !isValidTimezoneOffset(timezone)
  ) {
    return null;
  }

  return { year, month, day, hour, minute, second };
}

export function isValidEventDateTime(value: string): boolean {
  return parseEventDateTime(value) !== null;
}

export function isValidEventDateTimeParts(
  year: string,
  month: string,
  day: string,
  hour: string,
  minute: string,
  second: string,
): boolean {
  return (
    isValidEventDate(Number(year), Number(month), Number(day)) &&
    isValidEventTime(Number(hour), Number(minute), Number(second))
  );
}

function isValidEventDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 1) {
    return false;
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }

  if (!Number.isInteger(day) || day < 1) {
    return false;
  }

  return day <= daysInMonth(year, month);
}

function isValidEventTime(hour: number, minute: number, second: number): boolean {
  return (
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59 &&
    Number.isInteger(second) &&
    second >= 0 &&
    second <= 59
  );
}

function isValidTimezoneOffset(timezone: string | undefined): boolean {
  if (!timezone || timezone === 'Z') {
    return true;
  }

  const hour = Number(timezone.slice(1, 3));
  const minute = Number(timezone.slice(4, 6));

  if (!Number.isInteger(hour) || hour > 14) {
    return false;
  }

  if (!Number.isInteger(minute) || minute > 59) {
    return false;
  }

  return hour < 14 || minute === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }

  return 31;
}

function isLeapYear(year: number): boolean {
  if (year % 400 === 0) {
    return true;
  }

  if (year % 100 === 0) {
    return false;
  }

  return year % 4 === 0;
}

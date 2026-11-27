const MS_PER_SECOND = 1000;
const PER_MINUTE_OR_HOUR = 60;
const MAX_PARTS = 3;
const DIGITS = /^\d+$/;

/** `90`, `1:30` or `1:01:30` in milliseconds; anything else, or a part after a colon of 60 or more, is `null`. */
export function parseClock(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length > MAX_PARTS || !parts.every((part) => DIGITS.test(part))) return null;

  const [first = 0, ...rest] = parts.map(Number);
  if (rest.some((part) => part >= PER_MINUTE_OR_HOUR)) return null;

  const seconds = rest.reduce((total, part) => total * PER_MINUTE_OR_HOUR + part, first);
  return seconds * MS_PER_SECOND;
}

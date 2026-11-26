const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

const pad = (value: number) => String(value).padStart(2, '0');

/** `1:05` under an hour, `1:02:05` from one. */
export function formatTimecode(ms: number): string {
  const total = Math.floor(ms / MS_PER_SECOND);
  const seconds = total % SECONDS_PER_MINUTE;
  const minutes = Math.floor(total / SECONDS_PER_MINUTE) % MINUTES_PER_HOUR;
  const hours = Math.floor(total / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR));
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** `90`, `1:30` and `1:01:30` in milliseconds; anything else, or a seconds part of 60 or more, is `null`. */
export function parseTimecode(text: string): number | null {
  const parts = text.trim().split(':');
  if (parts.length > 3 || !parts.every((part) => /^\d{1,6}$/.test(part))) return null;

  const numbers = parts.map(Number);
  const seconds = numbers.at(-1) ?? 0;
  const minutes = numbers.at(-2) ?? 0;
  const hours = numbers.at(-3) ?? 0;
  if (parts.length > 1 && seconds >= SECONDS_PER_MINUTE) return null;
  if (parts.length > 2 && minutes >= MINUTES_PER_HOUR) return null;

  return ((hours * MINUTES_PER_HOUR + minutes) * SECONDS_PER_MINUTE + seconds) * MS_PER_SECOND;
}

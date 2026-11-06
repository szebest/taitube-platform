import { type Result, err, ok } from '@vp/result';
import { type InvalidField, invalidField } from '../failures';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

export const CAPACITY_MIN = 2;
export const SCHEDULE_WINDOW_MS = { min: 5 * MS_PER_MINUTE, max: 30 * MS_PER_DAY } as const;

export type InvalidCapacity = InvalidField<{ min: number; max: number }>;
export type InvalidSchedule = InvalidField<{ earliest: string; latest: string }>;

/** `ceiling` is the operator's `WATCH_PARTY_MAX_MEMBERS`; `null` means up to it. */
export function validateCapacity(
  capacity: number | null,
  ceiling: number
): Result<number | null, InvalidCapacity> {
  if (capacity === null) return ok(null);
  return Number.isInteger(capacity) && capacity >= CAPACITY_MIN && capacity <= ceiling
    ? ok(capacity)
    : err(
        invalidField('capacity', `capacity must be between ${CAPACITY_MIN} and ${ceiling}`, {
          min: CAPACITY_MIN,
          max: ceiling,
        })
      );
}

/** A scheduled start from 5 minutes to 30 days ahead of `now`; `null` clears the schedule. */
export function validateSchedule(
  scheduledFor: Date | null,
  now: Date
): Result<Date | null, InvalidSchedule> {
  if (scheduledFor === null) return ok(null);
  const earliest = new Date(now.getTime() + SCHEDULE_WINDOW_MS.min);
  const latest = new Date(now.getTime() + SCHEDULE_WINDOW_MS.max);
  return scheduledFor >= earliest && scheduledFor <= latest
    ? ok(scheduledFor)
    : err(
        invalidField('scheduledFor', 'scheduledFor must be 5 minutes to 30 days ahead', {
          earliest: earliest.toISOString(),
          latest: latest.toISOString(),
        })
      );
}

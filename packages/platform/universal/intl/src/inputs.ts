import { type Result, err, ok } from '@kit/result';
import { type FormatFailure, unrenderable } from './failures';

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * An ISO 8601 instant. A calendar date alone (`2024-05-01`) is declined: read as an instant it
 * is UTC midnight, the day before for every viewer west of UTC.
 */
export function parseInstant(formatter: string, iso: string): Result<Date, FormatFailure> {
  if (CALENDAR_DATE.test(iso)) {
    return err(unrenderable(formatter, `${iso} is a calendar date: format it as a plainDate`));
  }
  const instant = new Date(iso);
  return ISO_DATE_PREFIX.test(iso) && !Number.isNaN(instant.getTime())
    ? ok(instant)
    : err(unrenderable(formatter, `${iso} is not an ISO 8601 instant`));
}

/** A calendar date (`2024-05-01`) as UTC midnight, which a formatter must read in UTC. */
export function parseCalendarDate(formatter: string, text: string): Result<Date, FormatFailure> {
  const day = new Date(`${text}T00:00:00Z`);
  return CALENDAR_DATE.test(text) && day.toISOString().startsWith(text)
    ? ok(day)
    : err(unrenderable(formatter, `${text} is not a calendar date`));
}

export function finite(formatter: string, value: number): Result<number, FormatFailure> {
  return Number.isFinite(value)
    ? ok(value)
    : err(unrenderable(formatter, `${value} is not finite`));
}

export const isNumber = (value: unknown): value is number => typeof value === 'number';

export const isString = (value: unknown): value is string => typeof value === 'string';

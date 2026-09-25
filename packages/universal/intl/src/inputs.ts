import { type Result, err, ok } from '@vp/result';
import { type FormatFailure, unrenderable } from './failures';

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

export function parseInstant(formatter: string, iso: string): Result<Date, FormatFailure> {
  const instant = new Date(iso);
  return ISO_DATE_PREFIX.test(iso) && !Number.isNaN(instant.getTime())
    ? ok(instant)
    : err(unrenderable(formatter, `${iso} is not an ISO 8601 instant`));
}

export function finite(formatter: string, value: number): Result<number, FormatFailure> {
  return Number.isFinite(value)
    ? ok(value)
    : err(unrenderable(formatter, `${value} is not finite`));
}

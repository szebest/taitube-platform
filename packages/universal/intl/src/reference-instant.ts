import { type Result, err } from '@vp/result';
import type { FormatContext } from './context';
import { type FormatFailure, unrenderable } from './failures';
import { parseInstant } from './inputs';

/**
 * The instant "3 days ago" is measured from: the value's own `now`, else the context's. There is
 * no third source - reading the clock here would make a server render and its hydration disagree.
 */
export function referenceInstant(
  formatter: string,
  now: string | undefined,
  context: FormatContext
): Result<Date, FormatFailure> {
  const reference = now ?? context.now;
  return reference === undefined
    ? err(unrenderable(formatter, 'no reference instant in the value or the context'))
    : parseInstant(formatter, reference);
}

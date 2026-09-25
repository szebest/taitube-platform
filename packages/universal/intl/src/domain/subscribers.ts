import type { CountValue } from '../formatters/compact';

/** @public */
export function subscribers(count: number): CountValue {
  return { type: 'count', value: count };
}

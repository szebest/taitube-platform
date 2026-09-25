import type { CountValue } from '../formatters/compact';

/** @public */
export function commentCount(count: number): CountValue {
  return { type: 'count', value: count };
}

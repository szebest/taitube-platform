import type { CountValue } from '../formatters/compact';

/** @public */
export function views(count: number): CountValue {
  return { type: 'count', value: count };
}

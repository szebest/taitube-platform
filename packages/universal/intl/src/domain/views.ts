import type { CountValue } from '../formatters/compact';

export function views(count: number): CountValue {
  return { type: 'count', value: count };
}

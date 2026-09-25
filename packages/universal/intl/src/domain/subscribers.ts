import type { CountValue } from '../formatters/compact';

export function subscribers(count: number): CountValue {
  return { type: 'count', value: count };
}

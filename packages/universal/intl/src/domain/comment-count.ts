import type { CountValue } from '../formatters/compact';

export function commentCount(count: number): CountValue {
  return { type: 'count', value: count };
}

import type { CountValue } from '@kit/intl';

/** @public */
export function subscribers(count: number): CountValue {
  return { type: 'count', value: count };
}

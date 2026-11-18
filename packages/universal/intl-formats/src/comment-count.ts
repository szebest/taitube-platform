import type { CountValue } from '@kit/intl';

/** @public */
export function commentCount(count: number): CountValue {
  return { type: 'count', value: count };
}

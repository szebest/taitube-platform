import type { CountValue } from '@kit/intl';

/** @public */
export function views(count: number): CountValue {
  return { type: 'count', value: count };
}

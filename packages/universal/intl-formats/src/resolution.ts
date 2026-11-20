import type { NumberValue } from '@kit/intl';

/**
 * The height alone; the `p` of `1080p` is catalogue copy (`player.resolution`).
 * @public
 */
export function resolution(height: number): NumberValue {
  return { type: 'number', value: height, options: { useGrouping: false } };
}

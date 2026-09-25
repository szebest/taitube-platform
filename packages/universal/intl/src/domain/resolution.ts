import type { NumberValue } from '../formatters/number';

/** The height alone; the `p` of `1080p` is catalogue copy (`videos.resolution`). */
export function resolution(height: number): NumberValue {
  return { type: 'number', value: height, options: { useGrouping: false } };
}

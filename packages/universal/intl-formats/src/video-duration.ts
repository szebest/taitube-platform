import type { DurationValue } from '@kit/intl';

/** @public */
export function videoDuration(seconds: number): DurationValue {
  return { type: 'duration', value: seconds, options: { style: 'clock' } };
}

import type { DurationValue } from '../formatters/duration';

/** @public */
export function videoDuration(seconds: number): DurationValue {
  return { type: 'duration', value: seconds, options: { style: 'clock' } };
}

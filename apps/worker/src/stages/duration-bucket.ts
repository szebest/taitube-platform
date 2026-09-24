import { MS_PER_SECOND } from '@vp/domain/time';

/** The source-duration bands `time_to_ready_seconds` is split by (SDD §13.1). */
export function durationBucket(durationMs: number): '<1min' | '1-5' | '5-15' | '15-60' {
  const minutes = durationMs / MS_PER_SECOND / 60;
  if (minutes >= 15) return '15-60';
  if (minutes >= 5) return '5-15';
  if (minutes >= 1) return '1-5';
  return '<1min';
}

import { type Result, err, ok } from '@kit/result';
import { type LayoutScheduleInvalid, layoutScheduleInvalid } from './failures';

export function decideLayoutSchedule(input: {
  publishAt: Date;
  now: Date;
}): Result<Date, LayoutScheduleInvalid> {
  return input.publishAt > input.now ? ok(input.publishAt) : err(layoutScheduleInvalid());
}

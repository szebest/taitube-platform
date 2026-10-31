import { type Result, err, ok } from '@vp/result';
import { type InvalidPickWindow, invalidPickWindow } from './failures';

export interface PickWindow {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

/** A window that has begun may stay as it is; one that has ended cannot be scheduled or kept. */
export function validatePickWindow(
  window: PickWindow,
  now: Date
): Result<PickWindow, InvalidPickWindow> {
  if (window.endsAt.getTime() <= window.startsAt.getTime()) {
    return err(invalidPickWindow('endsAt', 'A pick must end after it starts'));
  }
  if (window.endsAt.getTime() <= now.getTime()) {
    return err(invalidPickWindow('endsAt', 'A pick must still be current or in the future'));
  }
  return ok(window);
}

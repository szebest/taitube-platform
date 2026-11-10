import type { AppearancePreference } from '@vp/ui';
import { changedPaths } from '#app/lib/preferences/preferences-change';
import { appearanceChange } from './appearance-change';
import type { MergeState } from './identity-reset';

/** The setting paths a signed-out viewer changed by `next`, measured from the baseline, which moves to `next`. */
export function noteGuestChange(
  baseline: MergeState['baseline'],
  next: AppearancePreference
): string[] {
  const change = appearanceChange(baseline.current ?? next, next);
  baseline.current = next;
  return change ? changedPaths(change) : [];
}

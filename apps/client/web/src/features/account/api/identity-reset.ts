import type { AppearancePreference } from '@kit/ui';
import type { QueryClient } from '@tanstack/react-query';
import type { PlaybackPreferences } from '@vp/domain/settings';
import { preferencesKeys } from '#app/lib/preferences/preferences-queries';

type AppliedVersion = { userId: string; version: number };

export type GuestSections = {
  appearance: AppearancePreference;
  playback: PlaybackPreferences;
};

export type MergeState = {
  applied: { current: AppliedVersion | undefined };
  guest: { current: GuestSections | undefined };
  /** The appearance a signed-out viewer's next change is measured from, so one the app made itself is not theirs. */
  baseline: { current: AppearancePreference | undefined };
};

/** One per tab, above the session, so an account or identity switch that mounts the tree again keeps it. */
export function createMergeState(): MergeState {
  return {
    applied: { current: undefined },
    guest: { current: undefined },
    baseline: { current: undefined },
  };
}

export function resetIdentityState(
  queryClient: QueryClient,
  merge: MergeState,
  restoreGuest: (guest: GuestSections) => void
): void {
  if (merge.guest.current) {
    merge.baseline.current = merge.guest.current.appearance;
    restoreGuest(merge.guest.current);
  }
  queryClient.removeQueries({ queryKey: preferencesKeys.all });
  merge.applied.current = undefined;
  merge.guest.current = undefined;
}

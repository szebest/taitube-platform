import type { QueryClient } from '@tanstack/react-query';
import type { PlaybackPreferences } from '@vp/domain/settings';
import type { AppearancePreference } from '@vp/ui';
import { preferencesKeys } from '#app/lib/preferences/preferences-queries';

export type AppliedVersion = { userId: string; version: number };

export type GuestSections = {
  appearance: AppearancePreference;
  playback: PlaybackPreferences;
};

export type MergeState = {
  applied: { current: AppliedVersion | undefined };
  guest: { current: GuestSections | undefined };
};

export function resetIdentityState(
  queryClient: QueryClient,
  merge: MergeState,
  restoreGuest: (guest: GuestSections) => void
): void {
  if (merge.guest.current) restoreGuest(merge.guest.current);
  queryClient.removeQueries({ queryKey: preferencesKeys.all });
  merge.applied.current = undefined;
  merge.guest.current = undefined;
}

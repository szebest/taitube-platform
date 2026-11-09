import { useQueryClient } from '@tanstack/react-query';
import { useAppearance } from '@vp/ui';
import { useDevicePreferences } from '#app/lib/preferences/device-preferences-provider';
import { type GuestSections, resetIdentityState } from '../api/identity-reset';
import { useMergeState } from '../components/preferences-sync/merge-state.context';

/** Call when the viewer switches account or channel: the next identity starts from the device's own settings. */
export function useResetIdentity(): () => void {
  const queryClient = useQueryClient();
  const merge = useMergeState();
  const appearance = useAppearance();
  const device = useDevicePreferences();

  const restoreGuest = (guest: GuestSections) => {
    appearance.replace(guest.appearance);
    device.replacePlayback(guest.playback);
  };

  return () => resetIdentityState(queryClient, merge, restoreGuest);
}

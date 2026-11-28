import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { PatchWatchPartyBody, WatchPartyView } from '@vp/api-contracts';
import type { WatchPartyPreset } from '@vp/domain';
import { useApi, useFailureToast } from '@vp/queries';
import { useT } from '#app/lib/messages';

export interface RoomSettingsChange {
  settings: Omit<PatchWatchPartyBody, 'version'>;
  preset: WatchPartyPreset | undefined;
}

function updateWatchPartyMutationOptions(
  api: ApiClient,
  room: WatchPartyView,
  failed: (error: Error) => void
) {
  return mutationOptions({
    mutationFn: async ({ settings, preset }: RoomSettingsChange) => {
      const updated = await api.watchParties.updateWatchParty({
        params: { id: room.id },
        body: { ...settings, version: room.version },
      });
      if (preset) {
        await api.watchPartyRoles.applyWatchPartyPreset({
          params: { id: room.id },
          body: { preset },
        });
      }
      return updated;
    },
    onError: failed,
  });
}

/** Saves a room's settings against the version read, and its preset when one is chosen. */
export function useUpdateWatchParty(room: WatchPartyView) {
  const api = useApi();
  const { tOr } = useT();
  const showFailure = useFailureToast();

  return useMutation(
    updateWatchPartyMutationOptions(api, room, (error) =>
      showFailure(tOr('party.settingsFailed', {}, ''), error)
    )
  );
}

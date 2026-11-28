import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const watchPartyControlsKey = ['watch-party-controls'] as const;

/** Every everywhere control, and with `roomId` that room's too; `party.controls.updated` invalidates the key. */
export function watchPartyControlsQueryOptions(api: ApiClient, roomId?: string) {
  return queryOptions({
    queryKey: [...watchPartyControlsKey, roomId ?? null],
    queryFn: () =>
      api.watchPartyControls.listWatchPartyControls({ query: roomId ? { roomId } : undefined }),
  });
}

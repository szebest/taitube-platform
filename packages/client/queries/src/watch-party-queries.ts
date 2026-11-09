import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

export const watchPartyKeys = {
  all: ['watch-parties'] as const,
  preview: (roomId: string, invite?: string) =>
    [...watchPartyKeys.all, 'preview', roomId, invite ?? null] as const,
  mine: () => [...watchPartyKeys.all, 'mine'] as const,
};

/** A room as a visitor sees it before they have a seat; a member's live view is the socket's. */
export function watchPartyPreviewQueryOptions(api: ApiClient, roomId: string, invite?: string) {
  return queryOptions({
    queryKey: watchPartyKeys.preview(roomId, invite),
    queryFn: () =>
      api.watchParties.getWatchParty({
        params: { id: roomId },
        query: invite ? { invite } : undefined,
      }),
  });
}

export function myWatchPartiesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: watchPartyKeys.mine(),
    queryFn: () => api.watchParties.listMyWatchParties({}),
  });
}

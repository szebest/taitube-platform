import { queryOptions, useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, watchPartyKeys } from '@vp/queries';

function roomInviteLinkQueryOptions(api: ApiClient, roomId: string) {
  return queryOptions({
    queryKey: [...watchPartyKeys.all, 'invite-link', roomId],
    queryFn: () =>
      api.watchPartyInvites.createWatchPartyInviteLink({
        params: { id: roomId },
        body: { ttl: '24h' },
      }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** A 24 h link that skips the password, made only when the room needs one; its token is shown once. */
export function useRoomInviteLink(roomId: string, needed: boolean) {
  const api = useApi();

  return useQuery({ ...roomInviteLinkQueryOptions(api, roomId), enabled: needed });
}

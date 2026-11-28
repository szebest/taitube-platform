import { queryOptions, useQuery } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi, watchPartyKeys } from '@vp/queries';

export const inviteCandidatesKey = (roomId: string) =>
  [...watchPartyKeys.all, 'invite-candidates', roomId] as const;

function inviteCandidatesQueryOptions(api: ApiClient, roomId: string, q: string) {
  return queryOptions({
    queryKey: [...inviteCandidatesKey(roomId), q],
    queryFn: () =>
      api.watchPartyInvites.listWatchPartyInviteCandidates({
        params: { id: roomId },
        query: q === '' ? undefined : { q },
      }),
  });
}

/** The people a room's inviter may invite, narrowed by what they typed; nothing is asked until the room exists. */
export function useInviteCandidates(roomId: string | undefined, q: string) {
  const api = useApi();

  return useQuery({
    ...inviteCandidatesQueryOptions(api, roomId ?? '', q),
    enabled: roomId !== undefined,
  });
}

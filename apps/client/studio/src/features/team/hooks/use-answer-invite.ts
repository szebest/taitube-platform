import { mutationOptions, type QueryClient, useMutation } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { teamKeys } from '#app/features/team/api/team-queries';

const refetchInvites = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: teamKeys.myInvites() });

/** Joining a team changes what the switcher lists, so the memberships are read again with the invites. */
export function useAcceptInvite() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.channelTeam.acceptChannelInvite({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) =>
        Promise.all([
          refetchInvites(client),
          client.invalidateQueries({ queryKey: teamKeys.memberships() }),
        ]),
    })
  );
}

export function useDeclineInvite() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.channelTeam.declineChannelInvite({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchInvites(client),
    })
  );
}

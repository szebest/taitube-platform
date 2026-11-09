import { mutationOptions, type QueryClient, useMutation } from '@tanstack/react-query';
import type { ContractBody, createChannelInvite } from '@vp/api-contracts';
import type { ChannelRole } from '@vp/domain';
import { useApi } from '@vp/queries';
import { teamKeys } from '#app/features/team/api/team-queries';

export type InviteDraft = ContractBody<typeof createChannelInvite>;

const refetchTeam = (client: QueryClient) => client.invalidateQueries({ queryKey: teamKeys.all });

export function useInviteMember() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (body: InviteDraft) => api.channelTeam.createChannelInvite({ body }),
      onSettled: (_data, _error, _body, _snapshot, { client }) => refetchTeam(client),
    })
  );
}

export function useRevokeInvite() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) => api.channelTeam.revokeChannelInvite({ params: { id } }),
      onSettled: (_data, _error, _id, _snapshot, { client }) => refetchTeam(client),
    })
  );
}

export function useChangeMemberRole() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: ({ userId, role }: { userId: string; role: ChannelRole }) =>
        api.channelTeam.changeChannelMemberRole({ params: { userId }, body: { role } }),
      onSettled: (_data, _error, _change, _snapshot, { client }) => refetchTeam(client),
    })
  );
}

export function useRemoveMember() {
  const api = useApi();

  return useMutation(
    mutationOptions({
      mutationFn: (userId: string) => api.channelTeam.removeChannelMember({ params: { userId } }),
      onSettled: (_data, _error, _userId, _snapshot, { client }) => refetchTeam(client),
    })
  );
}

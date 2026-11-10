import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { teamKeys } from '#app/features/team/api/team-queries';
import { useSwitchChannel } from './use-switch-channel';

/** Leaves the acting channel's team as `userId`, then goes back to the viewer's own channel. */
export function useLeaveTeam() {
  const api = useApi();
  const switchTo = useSwitchChannel();

  return useMutation(
    mutationOptions({
      mutationFn: (userId: string) => api.channelTeam.removeChannelMember({ params: { userId } }),
      onSuccess: async (_data, _userId, _snapshot, { client }) => {
        await client.invalidateQueries({ queryKey: teamKeys.memberships() });
        await switchTo(undefined, 'owner');
      },
    })
  );
}

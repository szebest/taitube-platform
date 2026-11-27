import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useApi, useIdentity, useIdentityChoices, useIdentitySwitcher } from '@vp/queries';
import { forgetChannelData } from '#app/features/team/api/ensure-acting-channel';
import { teamKeys } from '#app/features/team/api/team-queries';

/**
 * Leaves the acting channel's team as `userId`, then goes back to the viewer's own channel: the
 * tab's identity moves to the account's primary when it named the team's channel.
 */
export function useLeaveTeam() {
  const api = useApi();
  const router = useRouter();
  const tab = useIdentity();
  const { entries, targetOf } = useIdentityChoices(false);
  const { switchTo } = useIdentitySwitcher();
  const own = entries.find((entry) => entry.kind === 'account' && entry.identity.slot === tab.slot);

  return useMutation(
    mutationOptions({
      mutationFn: (userId: string) => api.channelTeam.removeChannelMember({ params: { userId } }),
      onSuccess: async (_data, _userId, _snapshot, { client }) => {
        await client.invalidateQueries({ queryKey: teamKeys.memberships() });
        router.options.context.actingChannel.select(undefined);
        forgetChannelData(client);
        if (tab.channel !== undefined && own) await switchTo(targetOf(own));
        await router.navigate({ to: '/videos', search: {} });
      },
    })
  );
}

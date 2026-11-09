import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { type ApiClient, ApiError } from '@vp/api-client';
import type { ContractBody, updateMyChannel } from '@vp/api-contracts';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { SESSION_KEY, type Session, useApi } from '@vp/queries';
import { actingChannelKeys } from '#app/features/channel/api/acting-channel';
import { useActiveChannel } from '#app/features/team/hooks/use-active-channel';

type ChannelChanges = ContractBody<typeof updateMyChannel>;

function updateChannelMutationOptions(
  api: ApiClient,
  channelId: string,
  own: boolean,
  refresh: () => Promise<void>
) {
  return mutationOptions({
    mutationFn: (changes: ChannelChanges) => api.me.updateMyChannel({ body: changes }),
    onSuccess: (channel, _changes, _snapshot, { client }) => {
      client.setQueryData(actingChannelKeys.channel(channelId), channel);
      if (own) {
        client.setQueryData<Session>(SESSION_KEY, (session) =>
          session?.status === 'signed-in'
            ? { ...session, account: { ...session.account, channel } }
            : session
        );
      }
      return refresh();
    },
  });
}

/** The code the API refused a channel change with, when it did. */
export function failureCodeOf(error: unknown): ErrorCode | undefined {
  return error instanceof ApiError
    ? Object.values(ErrorCodes).find((code) => code === error.code)
    : undefined;
}

/** One save of the acting channel; the session carries the channel only while it is the viewer's own. */
export function useUpdateChannel() {
  const { channelId, own } = useActiveChannel();
  const api = useApi();
  const router = useRouter();
  return useMutation(updateChannelMutationOptions(api, channelId, own, () => router.invalidate()));
}

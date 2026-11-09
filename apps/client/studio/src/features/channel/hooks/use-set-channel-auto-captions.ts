import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import type { OwnerChannel } from '@vp/api-contracts';
import { SESSION_KEY, type Session, useApi } from '@vp/queries';
import { actingChannelKeys } from '#app/features/channel/api/acting-channel';
import { useActiveChannel } from '#app/features/team/hooks/use-active-channel';

function setAutoCaptionsMutationOptions(
  api: ApiClient,
  channelId: string,
  own: boolean,
  refresh: () => Promise<void>
) {
  return mutationOptions({
    mutationFn: (enabled: boolean) => api.captions.setChannelAutoCaptions({ body: { enabled } }),
    onSuccess: ({ enabled }, _enabled, _snapshot, { client }) => {
      client.setQueryData<OwnerChannel>(
        actingChannelKeys.channel(channelId),
        (channel) => channel && { ...channel, autoCaptionsDefault: enabled }
      );
      if (own) {
        client.setQueryData<Session>(SESSION_KEY, (session) =>
          session?.status === 'signed-in'
            ? {
                ...session,
                account: {
                  ...session.account,
                  channel: { ...session.account.channel, autoCaptionsDefault: enabled },
                },
              }
            : session
        );
      }
      return refresh();
    },
  });
}

/** Saves the acting channel's captions default; the session carries the channel only while it is the viewer's own. */
export function useSetChannelAutoCaptions() {
  const { channelId, own } = useActiveChannel();
  const api = useApi();
  const router = useRouter();
  return useMutation(
    setAutoCaptionsMutationOptions(api, channelId, own, () => router.invalidate())
  );
}

import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import { SESSION_KEY, type Session, useApi } from '@vp/queries';

function setAutoCaptionsMutationOptions(api: ApiClient, refresh: () => Promise<void>) {
  return mutationOptions({
    mutationFn: (enabled: boolean) => api.captions.setChannelAutoCaptions({ body: { enabled } }),
    onSuccess: ({ enabled }, _enabled, _snapshot, { client }) => {
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
      return refresh();
    },
  });
}

/** Saves the channel's captions default into the session the whole app reads, then tells the router. */
export function useSetChannelAutoCaptions() {
  const api = useApi();
  const router = useRouter();
  return useMutation(setAutoCaptionsMutationOptions(api, () => router.invalidate()));
}

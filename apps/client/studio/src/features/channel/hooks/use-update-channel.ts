import { mutationOptions, useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { type ApiClient, ApiError } from '@vp/api-client';
import type { ContractBody, updateMyChannel } from '@vp/api-contracts';
import { type ErrorCode, ErrorCodes } from '@vp/errors';
import { SESSION_KEY, type Session, useApi } from '@vp/queries';

type ChannelChanges = ContractBody<typeof updateMyChannel>;

function updateChannelMutationOptions(api: ApiClient, refresh: () => Promise<void>) {
  return mutationOptions({
    mutationFn: (changes: ChannelChanges) => api.me.updateMyChannel({ body: changes }),
    onSuccess: (channel, _changes, _snapshot, { client }) => {
      client.setQueryData<Session>(SESSION_KEY, (session) =>
        session?.status === 'signed-in'
          ? { ...session, account: { ...session.account, channel } }
          : session
      );
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

/** One save of the channel; the viewer's session carries the channel, so it is rewritten and the router told. */
export function useUpdateChannel() {
  const api = useApi();
  const router = useRouter();
  return useMutation(updateChannelMutationOptions(api, () => router.invalidate()));
}

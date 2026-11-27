import { mutationOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import {
  type Accent,
  type Identity,
  identityKeys,
  SESSION_KEY,
  setIdentityAccent,
  setPinnedIdentities,
  useApi,
} from '@vp/queries';

const asInput = ({ slot, channel }: Identity) => (channel ? { slot, channel } : { slot });

/** The accent and the pinned order of the identities, kept in this browser's slot list. */
export function useIdentityLook() {
  const queryClient = useQueryClient();
  const reload = () => queryClient.invalidateQueries({ queryKey: identityKeys.accounts() });

  return {
    setAccent: async (identity: Identity, accent: Accent) => {
      await setIdentityAccent({ data: { ...asInput(identity), accent } });
      await reload();
    },
    setPinned: async (pinned: readonly Identity[]) => {
      await setPinnedIdentities({ data: { pinned: pinned.map(asInput) } });
      await reload();
    },
  };
}

/** Makes an owned channel the primary (`PATCH /v1/me/channels/:id`): the account opens as it from now on. */
export function usePromoteChannel() {
  const api = useApi();
  const router = useRouter();

  return useMutation(
    mutationOptions({
      mutationFn: (id: string) =>
        api.myChannels.promoteMyChannel({ params: { id }, body: { isPrimary: true } }),
      onSuccess: async (_channel, _id, _snapshot, { client }) => {
        await client.invalidateQueries({ queryKey: identityKeys.all });
        await client.invalidateQueries({ queryKey: SESSION_KEY });
        await router.invalidate();
      },
    })
  );
}

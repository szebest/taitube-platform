import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { useApi } from '@vp/queries';

function revealContactMutationOptions(api: ApiClient, channelId: string) {
  return mutationOptions({
    mutationFn: () => api.channelIdentity.revealChannelContact({ params: { id: channelId } }),
  });
}

/** Asks for the channel's contact email; the address is in the mutation's `data` once it answers. */
export function useRevealContact(channelId: string) {
  return useMutation(revealContactMutationOptions(useApi(), channelId));
}

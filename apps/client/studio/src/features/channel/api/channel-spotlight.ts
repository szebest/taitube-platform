import { mutationOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ChannelSpotlightSettings } from '@vp/api-contracts';
import { actingChannelKeys } from './acting-channel';

const spotlightKey = (channelId: string) =>
  [...actingChannelKeys.channel(channelId), 'spotlight'] as const;

/** What the channel saved as its trailer, its subscriber video and its per-language overrides. */
export function spotlightQueryOptions(api: ApiClient, channelId: string) {
  return queryOptions({
    queryKey: spotlightKey(channelId),
    queryFn: () => api.channelIdentity.getMySpotlight(),
  });
}

export function saveSpotlightMutationOptions(api: ApiClient, channelId: string) {
  return mutationOptions({
    mutationFn: (settings: ChannelSpotlightSettings) =>
      api.channelIdentity.setMySpotlight({ body: settings }),
    onSuccess: (saved, _settings, _snapshot, { client }) =>
      client.setQueryData(spotlightKey(channelId), saved),
  });
}

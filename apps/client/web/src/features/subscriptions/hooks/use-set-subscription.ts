import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { Channel } from '@vp/api-contracts';
import { useApi } from '@vp/queries';

import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { feedKeys } from '#app/features/feed/api/feed-queries';
import { restoreQueryData } from '#app/integrations/query/restore-query-data';

import { subscriptionKeys, subscriptionStatusQueryOptions } from '../api/subscription-queries';

function recount(channel: Channel, subscribed: boolean): Channel {
  return { ...channel, subscriberCount: channel.subscriberCount + (subscribed ? 1 : -1) };
}

function setSubscriptionMutationOptions(api: ApiClient, channelId: string) {
  const statusKey = subscriptionStatusQueryOptions(api, channelId).queryKey;
  const channelKey = channelQueryOptions(api, channelId).queryKey;
  const target = { params: { id: channelId } };

  return mutationOptions({
    mutationFn: (subscribed: boolean) =>
      subscribed
        ? api.subscriptions.subscribeToChannel(target)
        : api.subscriptions.unsubscribeFromChannel(target),
    onMutate: async (subscribed, { client }) => {
      await Promise.all([
        client.cancelQueries({ queryKey: statusKey }),
        client.cancelQueries({ queryKey: channelKey }),
      ]);
      const previousStatus = client.getQueryData(statusKey);
      const previousChannel = client.getQueryData(channelKey);

      client.setQueryData(statusKey, { channelId, subscribed });
      if (previousChannel && previousStatus?.subscribed !== subscribed) {
        client.setQueryData(channelKey, recount(previousChannel, subscribed));
      }
      return { previousStatus, previousChannel };
    },
    onError: (_error, _subscribed, snapshot, { client }) => {
      restoreQueryData(client, statusKey, snapshot?.previousStatus);
      restoreQueryData(client, channelKey, snapshot?.previousChannel);
    },
    onSettled: (_data, _error, _subscribed, _snapshot, { client }) =>
      Promise.all([
        client.invalidateQueries({ queryKey: subscriptionKeys.all }),
        client.invalidateQueries({ queryKey: channelKey }),
        client.invalidateQueries({ queryKey: feedKeys.subscriptions() }),
      ]),
  });
}

export function useSetSubscription(channelId: string) {
  const api = useApi();
  return useMutation(setSubscriptionMutationOptions(api, channelId));
}

import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { PublicChannel } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { restoreQueryData } from '#app/integrations/query/restore-query-data';
import { channelQueryOptions, channelSpotlightScope } from '#app/lib/query-keys/channel-keys';
import { channelPageScope } from '#app/lib/query-keys/channel-page-keys';
import { feedKeys } from '#app/lib/query-keys/feed-keys';
import {
  subscriptionKeys,
  subscriptionStatusQueryOptions,
} from '#app/lib/query-keys/subscription-keys';

function recount(channel: PublicChannel, subscribed: boolean): PublicChannel {
  return { ...channel, subscriberCount: channel.subscriberCount + (subscribed ? 1 : -1) };
}

function setSubscriptionMutationOptions(
  api: ApiClient,
  channelId: string,
  fromVideoId: string | undefined
) {
  const statusKey = subscriptionStatusQueryOptions(api, channelId).queryKey;
  const channelKey = channelQueryOptions(api, channelId).queryKey;
  const target = { params: { id: channelId } };

  return mutationOptions({
    mutationFn: (subscribed: boolean) =>
      subscribed
        ? api.subscriptions.subscribeToChannel({
            ...target,
            body: fromVideoId ? { fromVideoId } : undefined,
          })
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
        client.invalidateQueries({ queryKey: channelSpotlightScope(channelId) }),
        client.invalidateQueries({ queryKey: channelPageScope(channelId) }),
        client.invalidateQueries({ queryKey: feedKeys.subscriptions() }),
      ]),
  });
}

/** `fromVideoId` credits the subscription to the video of the watch page it was made on. */
export function useSetSubscription(channelId: string, fromVideoId?: string) {
  const api = useApi();
  return useMutation(setSubscriptionMutationOptions(api, channelId, fromVideoId));
}

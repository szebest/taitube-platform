import { mutationOptions, useMutation } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { NotificationLevel } from '@vp/domain';
import { useApi } from '@vp/queries';
import { restoreQueryData } from '#app/integrations/query/restore-query-data';
import { mySubscriptionsQueryOptions, subscriptionKeys } from '../api/subscription-queries';

function setSubscriptionLevelMutationOptions(api: ApiClient, channelId: string) {
  const listKey = mySubscriptionsQueryOptions(api).queryKey;

  return mutationOptions({
    mutationFn: (level: NotificationLevel) =>
      api.subscriptions.updateSubscriptionLevel({ params: { id: channelId }, body: { level } }),
    onMutate: async (level, { client }) => {
      await client.cancelQueries({ queryKey: listKey });
      const previousList = client.getQueryData(listKey);

      client.setQueryData(
        listKey,
        (list) =>
          list && {
            ...list,
            items: list.items.map((channel) =>
              channel.id === channelId ? { ...channel, notificationLevel: level } : channel
            ),
          }
      );
      return { previousList };
    },
    onError: (_error, _level, snapshot, { client }) =>
      restoreQueryData(client, listKey, snapshot?.previousList),
    onSettled: (_data, _error, _level, _snapshot, { client }) =>
      client.invalidateQueries({ queryKey: subscriptionKeys.all }),
  });
}

/** Sets how much one subscribed channel may notify the viewer; the choice shows before the answer. */
export function useSetSubscriptionLevel(channelId: string) {
  const api = useApi();
  return useMutation(setSubscriptionLevelMutationOptions(api, channelId));
}

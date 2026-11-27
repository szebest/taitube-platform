import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ActingChannelStore, Session } from '@vp/queries';
import { actingChannelQueryOptions } from './acting-channel';
import { spotlightQueryOptions } from './channel-spotlight';

interface PrefetchContext {
  api: ApiClient;
  queryClient: QueryClient;
  auth: Session;
  actingChannel: ActingChannelStore;
}

/** The acting channel and its spotlight, so the sections render on the server instead of after hydration. */
export async function prefetchCustomization({
  api,
  queryClient,
  auth,
  actingChannel,
}: PrefetchContext): Promise<void> {
  if (auth.status !== 'signed-in') return;

  const channelId = actingChannel.read() ?? auth.account.channel.id;
  await Promise.all([
    queryClient.query(actingChannelQueryOptions(api, channelId)),
    queryClient.query(spotlightQueryOptions(api, channelId)),
  ]);
}

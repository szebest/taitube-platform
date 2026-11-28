import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ActingChannelStore, Session } from '@vp/queries';
import { pageDraftQueryOptions } from './page-queries';

interface PrefetchContext {
  api: ApiClient;
  queryClient: QueryClient;
  auth: Session;
  actingChannel: ActingChannelStore;
}

export async function prefetchPageBuilder({
  api,
  queryClient,
  auth,
  actingChannel,
}: PrefetchContext): Promise<void> {
  if (auth.status !== 'signed-in') {
    return;
  }

  const channelId = actingChannel.read() ?? auth.account.channel.id;
  await queryClient.query(pageDraftQueryOptions(api, channelId));
}

import type { QueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { PostStatus } from '@vp/domain';
import type { ActingChannelStore, Session } from '@vp/queries';
import { managedPostsQueryOptions } from './post-queries';

interface PrefetchContext {
  api: ApiClient;
  queryClient: QueryClient;
  auth: Session;
  actingChannel: ActingChannelStore;
}

/** The first page of the acting channel's posts, so the table renders on the server. */
export async function prefetchPosts(
  { api, queryClient, auth, actingChannel }: PrefetchContext,
  status: PostStatus | undefined
): Promise<void> {
  if (auth.status !== 'signed-in') return;

  const channelId = actingChannel.read() ?? auth.account.channel.id;
  await queryClient.infiniteQuery(managedPostsQueryOptions(api, channelId, status));
}

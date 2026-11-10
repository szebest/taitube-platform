import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import type { ApiClient } from '@vp/api-client';
import { ensureFound, prefetched, type Session } from '@vp/queries';
import {
  channelQueryOptions,
  channelSpotlightQueryOptions,
  channelStartHereQueryOptions,
} from '#app/lib/query-keys/channel-keys';

export interface ChannelLoadContext {
  queryClient: QueryClient;
  api: ApiClient;
  locale: string;
  auth: Session;
}

const MOVED_PERMANENTLY = 301;

/**
 * What both channel routes load for an id or a handle: the channel, sent on with a `301` to its
 * current handle when the address named a retired one, then the shelf and the spotlight, each under the
 * channel's id so every reader of the page shares one cache entry whichever address got here.
 */
export async function loadChannelPage(
  { queryClient, api, locale, auth }: ChannelLoadContext,
  idOrHandle: string
) {
  const channel = await ensureFound(queryClient, channelQueryOptions(api, idOrHandle));
  if (channel.redirectedFrom !== null) {
    throw redirect({
      to: '/@{$handle}',
      params: { handle: channel.handle },
      statusCode: MOVED_PERMANENTLY,
    });
  }

  queryClient.setQueryData(channelQueryOptions(api, channel.id).queryKey, channel);
  const startHere = channelStartHereQueryOptions(api, channel.id);
  const viewerId = auth.status === 'signed-in' ? auth.account.id : null;
  await Promise.all([
    prefetched(queryClient.query(startHere)),
    prefetched(queryClient.query(channelSpotlightQueryOptions(api, channel.id, locale, viewerId))),
  ]);

  return { channel, videos: queryClient.getQueryData(startHere.queryKey)?.items ?? [] };
}

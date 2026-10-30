import { createFileRoute } from '@tanstack/react-router';
import { ChannelIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam } from '@vp/queries';
import { z } from 'zod';

import { WEB_URL } from '#app/config';
import {
  channelQueryOptions,
  channelVideosQueryOptions,
} from '#app/features/channels/api/channel-queries';
import { channelHead } from '#app/features/seo/channel-head';
import { UserPage } from '#app/modules/UserPage';

export const Route = createFileRoute('/channel/$channelId')({
  params: {
    parse: ({ channelId }) => ({ channelId: parseParam(ChannelIdParamSchema.shape.id, channelId) }),
    stringify: ({ channelId }) => ({ channelId }),
  },
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api }, params: { channelId } }) => {
    const videosOptions = channelVideosQueryOptions(api, channelId);
    const channel = await ensureFound(queryClient, channelQueryOptions(api, channelId));
    await queryClient.prefetchQuery(videosOptions);
    return { channel, videos: queryClient.getQueryData(videosOptions.queryKey)?.items ?? [] };
  },
  head: ({ loaderData }) =>
    loaderData ? channelHead(loaderData.channel, loaderData.videos, WEB_URL) : {},
  component: UserPage,
});

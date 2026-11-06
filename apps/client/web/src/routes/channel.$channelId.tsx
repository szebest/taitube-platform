import { createFileRoute } from '@tanstack/react-router';
import { ChannelIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam } from '@vp/queries';
import { z } from 'zod';
import { WEB_URL } from '#app/config';
import {
  channelQueryOptions,
  channelStartHereQueryOptions,
} from '#app/features/channels/api/channel-queries';
import { ChannelPage } from '#app/features/channels/components/channel-page';
import { channelHead } from '#app/features/seo/channel-head';
import { headWords } from '#app/features/seo/head-words';

export const Route = createFileRoute('/channel/$channelId')({
  params: {
    parse: ({ channelId }) => ({ channelId: parseParam(ChannelIdParamSchema.shape.id, channelId) }),
    stringify: ({ channelId }) => ({ channelId }),
  },
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api }, params: { channelId } }) => {
    const startHereOptions = channelStartHereQueryOptions(api, channelId);
    const channel = await ensureFound(queryClient, channelQueryOptions(api, channelId));
    await queryClient.prefetchQuery(startHereOptions);
    return { channel, videos: queryClient.getQueryData(startHereOptions.queryKey)?.items ?? [] };
  },
  head: ({ loaderData, match }) =>
    loaderData
      ? channelHead(
          loaderData.channel,
          loaderData.videos,
          WEB_URL,
          headWords(match.context.locales.snapshot())
        )
      : {},
  component: ChannelPage,
});

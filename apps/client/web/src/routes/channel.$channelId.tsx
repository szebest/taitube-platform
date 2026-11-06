import { createFileRoute } from '@tanstack/react-router';
import { ChannelIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam } from '@vp/queries';
import { z } from 'zod';
import {
  ChannelPage,
  channelQueryOptions,
  channelStartHereQueryOptions,
} from '#app/features/channel';
import { WEB_URL } from '#app/lib/config';
import { channelHead } from '#app/lib/seo/channel-head';
import { headWords } from '#app/lib/seo/head-words';

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

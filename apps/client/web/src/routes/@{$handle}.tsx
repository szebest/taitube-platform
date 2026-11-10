import { createFileRoute } from '@tanstack/react-router';
import { ChannelHandleParamSchema } from '@vp/api-contracts';
import { parseParam } from '@vp/queries';
import { z } from 'zod';
import { ChannelPage, loadChannelPage } from '#app/features/channel';
import { WEB_URL } from '#app/lib/config';
import { channelHead } from '#app/lib/seo/channel-head';
import { headWords } from '#app/lib/seo/head-words';

export const Route = createFileRoute('/@{$handle}')({
  params: {
    parse: ({ handle }) => ({
      handle: parseParam(ChannelHandleParamSchema.shape.idOrHandle, handle),
    }),
    stringify: ({ handle }) => ({ handle }),
  },
  validateSearch: z.object({}),
  loader: ({ context, params: { handle } }) => loadChannelPage(context, handle),
  head: ({ loaderData, match }) =>
    loaderData
      ? channelHead(
          loaderData.channel,
          loaderData.videos,
          WEB_URL,
          headWords(match.context.locales.snapshot())
        )
      : {},
  component: function ChannelByHandle() {
    const { channel } = Route.useLoaderData();
    return <ChannelPage channelId={channel.id} />;
  },
});

import { createFileRoute } from '@tanstack/react-router';
import { ChannelIdParamSchema } from '@vp/api-contracts';
import { parseParam } from '@vp/queries';
import { z } from 'zod';
import { ChannelPage, loadChannelPage } from '#app/features/channel';
import { WEB_URL } from '#app/lib/config';
import { channelHead } from '#app/lib/seo/channel-head';
import { headWords } from '#app/lib/seo/head-words';

export const Route = createFileRoute('/channel/$channelId')({
  params: {
    parse: ({ channelId }) => ({ channelId: parseParam(ChannelIdParamSchema.shape.id, channelId) }),
    stringify: ({ channelId }) => ({ channelId }),
  },
  validateSearch: z.object({}),
  loader: ({ context, params: { channelId } }) => loadChannelPage(context, channelId),
  head: ({ loaderData, match }) =>
    loaderData
      ? channelHead(
          loaderData.channel,
          loaderData.videos,
          WEB_URL,
          headWords(match.context.locales.snapshot())
        )
      : {},
  component: function ChannelById() {
    const { channelId } = Route.useParams();
    return <ChannelPage channelId={channelId} />;
  },
});

import { parseParam } from '@kit/query';
import { createFileRoute } from '@tanstack/react-router';
import { ChannelHandleParamSchema } from '@vp/api-contracts';
import { ChannelLanding, ChannelPageSearchSchema, loadChannelLanding } from '#app/features/channel';
import { WEB_URL } from '#app/lib/config';
import { channelHead } from '#app/lib/seo/channel-head';
import { headWords } from '#app/lib/seo/head-words';

export const Route = createFileRoute('/channels/$handle/')({
  params: {
    parse: ({ handle }) => ({
      handle: parseParam(ChannelHandleParamSchema.shape.idOrHandle, handle),
    }),
    stringify: ({ handle }) => ({ handle }),
  },
  validateSearch: ChannelPageSearchSchema,
  loaderDeps: ({ search: { preview, as } }) => ({ preview, as }),
  loader: ({ context, params: { handle }, deps }) =>
    loadChannelLanding(context, handle, undefined, deps),
  head: ({ loaderData, match }) =>
    loaderData
      ? channelHead(loaderData.channel, [], WEB_URL, headWords(match.context.locales.snapshot()))
      : {},
  component: function ChannelLandingRoute() {
    const { args } = Route.useLoaderData();
    return <ChannelLanding args={args} />;
  },
});

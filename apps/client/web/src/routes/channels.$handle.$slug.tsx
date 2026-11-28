import { parseParam } from '@kit/query';
import { createFileRoute } from '@tanstack/react-router';
import { ChannelHandleParamSchema } from '@vp/api-contracts';
import { z } from 'zod';
import { ChannelLanding, ChannelPageSearchSchema, loadChannelLanding } from '#app/features/channel';
import { WEB_URL } from '#app/lib/config';
import { channelHead } from '#app/lib/seo/channel-head';
import { headWords } from '#app/lib/seo/head-words';

const SlugSchema = z.string().min(1).max(64);

export const Route = createFileRoute('/channels/$handle/$slug')({
  params: {
    parse: ({ handle, slug }) => ({
      handle: parseParam(ChannelHandleParamSchema.shape.idOrHandle, handle),
      slug: parseParam(SlugSchema, slug),
    }),
    stringify: ({ handle, slug }) => ({ handle, slug }),
  },
  validateSearch: ChannelPageSearchSchema,
  loaderDeps: ({ search: { preview, as } }) => ({ preview, as }),
  loader: ({ context, params: { handle, slug }, deps }) =>
    loadChannelLanding(context, handle, slug, deps),
  head: ({ loaderData, match }) =>
    loaderData
      ? channelHead(loaderData.channel, [], WEB_URL, headWords(match.context.locales.snapshot()))
      : {},
  component: function ChannelTabRoute() {
    const { args } = Route.useLoaderData();
    return <ChannelLanding args={args} />;
  },
});

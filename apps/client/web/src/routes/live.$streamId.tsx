import { createFileRoute } from '@tanstack/react-router';
import { LiveStreamIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam } from '@vp/queries';
import { z } from 'zod';
import { liveStreamQueryOptions, LiveWatchPage } from '#app/features/live';
import { WEB_URL } from '#app/lib/config';
import { headWords } from '#app/lib/seo/head-words';
import { liveHead } from '#app/lib/seo/live-head';

export const Route = createFileRoute('/live/$streamId')({
  params: {
    parse: ({ streamId }) => ({
      streamId: parseParam(LiveStreamIdParamSchema.shape.id, streamId),
    }),
    stringify: ({ streamId }) => ({ streamId }),
  },
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api }, params: { streamId } }) =>
    ensureFound(queryClient, liveStreamQueryOptions(api, streamId)),
  head: ({ loaderData, match }) =>
    loaderData ? liveHead(loaderData, WEB_URL, headWords(match.context.locales.snapshot())) : {},
  component: LiveWatchPage,
});

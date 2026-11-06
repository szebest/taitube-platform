import { createFileRoute } from '@tanstack/react-router';
import { LiveStreamIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam } from '@vp/queries';
import { z } from 'zod';

import { WEB_URL } from '#app/config';
import { liveStreamQueryOptions } from '#app/features/live/api/live-queries';
import { LiveWatchPage } from '#app/features/live/components/live-watch-page';
import { headWords } from '#app/features/seo/head-words';
import { liveHead } from '#app/features/seo/live-head';

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

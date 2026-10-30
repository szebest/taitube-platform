import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, videoQueryOptions } from '@vp/queries';
import { z } from 'zod';

import { shortsFeedQueryOptions } from '#app/features/feed/api/feed-queries';

/** The `/shorts` page, which stays mounted while the Short it names changes; this route only names one. */
export const Route = createFileRoute('/shorts/$videoId')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api }, params: { videoId } }) => {
    const feed = await queryClient.ensureInfiniteQueryData(shortsFeedQueryOptions(api));
    const served = feed.pages.some(({ items }) => items.some(({ id }) => id === videoId));
    if (!served) {
      await ensureFound(queryClient, videoQueryOptions(api, videoId));
    }
  },
  component: () => null,
});

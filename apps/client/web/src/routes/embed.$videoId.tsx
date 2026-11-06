import { createFileRoute, notFound } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, videoQueryOptions } from '@vp/queries';
import { EmbedNotFound, EmbedPage, EmbedSearchSchema } from '#app/features/embed';

export const Route = createFileRoute('/embed/$videoId')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: EmbedSearchSchema,
  loader: async ({ context: { queryClient, api }, params: { videoId } }) => {
    const video = await ensureFound(queryClient, videoQueryOptions(api, videoId));
    if (video.visibility !== 'public' || video.status !== 'READY') throw notFound();
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }] }),
  notFoundComponent: EmbedNotFound,
  component: EmbedPage,
});

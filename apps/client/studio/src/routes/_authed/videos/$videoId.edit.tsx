import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, videoQueryOptions } from '@vp/queries';
import { z } from 'zod';

import { categoriesQueryOptions } from '#app/features/videos/api/category-queries';
import { EditVideoPage } from '#app/features/videos/components/edit-video-page';

export const Route = createFileRoute('/_authed/videos/$videoId/edit')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api }, params: { videoId } }) => {
    await Promise.all([
      ensureFound(queryClient, videoQueryOptions(api, videoId)),
      queryClient.prefetchQuery(categoriesQueryOptions(api)),
    ]);
  },
  component: EditRoute,
});

function EditRoute() {
  const { videoId } = Route.useParams();
  return <EditVideoPage videoId={videoId} />;
}

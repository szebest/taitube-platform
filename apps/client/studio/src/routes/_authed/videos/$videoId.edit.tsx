import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, videoQueryOptions, prefetched } from '@vp/queries';
import { z } from 'zod';
import { LazyCaptionsSection } from '#app/features/captions';
import { categoriesQueryOptions, EditVideoPage } from '#app/features/videos';

export const Route = createFileRoute('/_authed/videos/$videoId/edit')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api }, params: { videoId } }) => {
    await Promise.all([
      ensureFound(queryClient, videoQueryOptions(api, videoId)),
      prefetched(queryClient.query(categoriesQueryOptions(api))),
    ]);
  },
  component: EditRoute,
});

function EditRoute() {
  const { videoId } = Route.useParams();
  return <EditVideoPage videoId={videoId} captions={<LazyCaptionsSection videoId={videoId} />} />;
}

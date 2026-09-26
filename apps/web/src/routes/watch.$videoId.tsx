import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { z } from 'zod';

import { videoQueryOptions } from '#app/features/videos/api/video-queries';
import { ensureFound } from '#app/integrations/query/ensure-found';
import { parseParam } from '#app/integrations/router/parse-param';
import { VideoPage } from '#app/modules/VideoPage';

export const Route = createFileRoute('/watch/$videoId')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: ({ context: { queryClient }, params: { videoId } }) =>
    ensureFound(queryClient, videoQueryOptions(videoId)),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title ?? 'Taitube' }] }),
  component: VideoPage,
});

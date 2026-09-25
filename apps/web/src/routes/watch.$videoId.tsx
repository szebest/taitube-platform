import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { z } from 'zod';

import { ensureVideo } from '#app/features/watch/api/ensure-video';
import { parseParam } from '#app/integrations/router/parse-param';
import { VideoPage } from '#app/modules/VideoPage';

export const Route = createFileRoute('/watch/$videoId')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: ({ context: { queryClient }, params: { videoId } }) => ensureVideo(queryClient, videoId),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title ?? 'Taitube' }] }),
  component: VideoPage,
});

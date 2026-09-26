import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { z } from 'zod';

import { videoQueryOptions } from '#app/features/videos/api/video-queries';
import { ensureFound } from '#app/integrations/query/ensure-found';
import { parseParam } from '#app/integrations/router/parse-param';
import { EditPage } from '#app/modules/Upload';

export const Route = createFileRoute('/_authed/upload/edit/$videoId')({
  staticData: { layoutMaxWidth: '1280px' },
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient }, params: { videoId } }) => {
    await ensureFound(queryClient, videoQueryOptions(videoId));
  },
  component: EditPage,
});

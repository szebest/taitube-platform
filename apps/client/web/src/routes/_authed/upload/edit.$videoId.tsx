import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, readAuthToken, videoQueryOptions } from '@vp/queries';
import { z } from 'zod';

import { EditPage } from '#app/modules/Upload';

export const Route = createFileRoute('/_authed/upload/edit/$videoId')({
  staticData: { layoutMaxWidth: '1280px' },
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api }, params: { videoId } }) => {
    if (readAuthToken() === null) return;
    await ensureFound(queryClient, videoQueryOptions(api, videoId));
  },
  component: EditPage,
});

import { createFileRoute, redirect } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { parseParam } from '@vp/queries';
import { z } from 'zod';

export const Route = createFileRoute('/_authed/videos/$videoId/')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  beforeLoad: () => {
    throw redirect({ to: '/videos', replace: true });
  },
});

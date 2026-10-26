import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { parseParam, videoRetentionQueryOptions } from '@vp/queries';
import { z } from 'zod';

import { AnalyticsPage } from '#app/modules/Analytics';

export const Route = createFileRoute('/_authed/videos/$videoId/analytics')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api }, params: { videoId } }) =>
    queryClient.ensureQueryData(videoRetentionQueryOptions(api, videoId)),
  component: AnalyticsPage,
});

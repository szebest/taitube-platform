import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { parseParam, videoRetentionQueryOptions } from '@vp/queries';
import {
  analyticsQueryOptions,
  AnalyticsSearchSchema,
  VideoAnalyticsPage,
} from '#app/features/analytics';

export const Route = createFileRoute('/_authed/videos/$videoId/analytics')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: AnalyticsSearchSchema,
  loaderDeps: ({ search: { range } }) => ({ range }),
  loader: ({ context: { queryClient, api }, params: { videoId }, deps: { range } }) =>
    Promise.all([
      queryClient.prefetchQuery(analyticsQueryOptions(api, { kind: 'video', videoId }, range)),
      queryClient.prefetchQuery(videoRetentionQueryOptions(api, videoId)),
    ]),
  component: VideoAnalyticsPage,
});

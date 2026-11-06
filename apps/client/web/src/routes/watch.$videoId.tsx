import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, videoQueryOptions } from '@vp/queries';
import { z } from 'zod';

import { WEB_URL } from '#app/config';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { headWords } from '#app/features/seo/head-words';
import { videoHead } from '#app/features/seo/video-head';
import { relatedQueryOptions } from '#app/features/watch/api/related-queries';
import { WatchPage } from '#app/features/watch/components/watch-page';
import { WatchPending } from '#app/features/watch/components/watch-pending';

const NonNegativeIntSchema = z.coerce.number().int().nonnegative();
const PlaylistIdSchema = z.uuid();

function validOrUndefined<T>(schema: z.ZodType<T>) {
  return z
    .unknown()
    .optional()
    .transform((value) => {
      const parsed = schema.safeParse(value);
      return parsed.success ? parsed.data : undefined;
    });
}

export const Route = createFileRoute('/watch/$videoId')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: z.object({
    t: validOrUndefined(NonNegativeIntSchema),
    list: validOrUndefined(PlaylistIdSchema),
    index: validOrUndefined(NonNegativeIntSchema),
  }),
  loader: async ({ context: { queryClient, api }, params: { videoId } }) => {
    const video = await ensureFound(queryClient, videoQueryOptions(api, videoId));
    await Promise.all([
      video.channel && queryClient.prefetchQuery(channelQueryOptions(api, video.channel.id)),
      queryClient.prefetchQuery(relatedQueryOptions(api, videoId)),
    ]);
    return video;
  },
  head: ({ loaderData, match }) =>
    loaderData ? videoHead(loaderData, WEB_URL, headWords(match.context.locales.snapshot())) : {},
  pendingComponent: WatchPending,
  component: WatchPage,
});

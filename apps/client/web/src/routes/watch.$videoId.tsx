import { createFileRoute } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, videoQueryOptions } from '@vp/queries';
import { z } from 'zod';
import { channelQueryOptions } from '#app/features/channel';
import { playlistQueryOptions } from '#app/features/library';
import { relatedQueryOptions, WatchPage, WatchPending } from '#app/features/watch';
import { WEB_URL } from '#app/lib/config';
import { headWords } from '#app/lib/seo/head-words';
import { videoHead } from '#app/lib/seo/video-head';

const NonNegativeIntSchema = z.coerce.number().int().nonnegative();
const UuidSchema = z.uuid();

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
    list: validOrUndefined(UuidSchema),
    index: validOrUndefined(NonNegativeIntSchema),
    comment: validOrUndefined(UuidSchema),
  }),
  loaderDeps: ({ search: { list } }) => ({ list }),
  loader: async ({ context: { queryClient, api }, params: { videoId }, deps: { list } }) => {
    const video = await ensureFound(queryClient, videoQueryOptions(api, videoId));
    await Promise.all([
      video.channel && queryClient.prefetchQuery(channelQueryOptions(api, video.channel.id)),
      queryClient.prefetchQuery(relatedQueryOptions(api, videoId)),
      list && queryClient.prefetchQuery(playlistQueryOptions(api, list)),
    ]);
    return video;
  },
  head: ({ loaderData, match }) =>
    loaderData ? videoHead(loaderData, WEB_URL, headWords(match.context.locales.snapshot())) : {},
  pendingComponent: WatchPending,
  component: WatchPage,
});

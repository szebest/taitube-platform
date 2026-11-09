import { createFileRoute } from '@tanstack/react-router';
import { type Video, VideoIdParamSchema } from '@vp/api-contracts';
import { ensureFound, parseParam, videoQueryOptions, prefetched } from '@vp/queries';
import { z } from 'zod';
import { ClipAction } from '#app/features/clips';
import { SaveOfflineToggle } from '#app/features/offline';
import { WatchPage, WatchPending } from '#app/features/watch';
import { useSignIn } from '#app/hooks/use-sign-in';
import { WEB_URL } from '#app/lib/config';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { relatedQueryOptions } from '#app/lib/query-keys/related-keys';
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

function EngagementActions({ video }: { video: Video }) {
  const signIn = useSignIn();

  return (
    <>
      <SaveOfflineToggle video={video} />
      <ClipAction video={video} onSignIn={signIn} />
    </>
  );
}

function Watch() {
  return <WatchPage renderActions={(video) => <EngagementActions video={video} />} />;
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
      video.channel && prefetched(queryClient.query(channelQueryOptions(api, video.channel.id))),
      prefetched(queryClient.query(relatedQueryOptions(api, videoId))),
      list && prefetched(queryClient.query(playlistQueryOptions(api, list))),
    ]);
    return video;
  },
  head: ({ loaderData, match }) =>
    loaderData ? videoHead(loaderData, WEB_URL, headWords(match.context.locales.snapshot())) : {},
  pendingComponent: WatchPending,
  component: Watch,
});

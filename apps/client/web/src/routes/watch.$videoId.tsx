import { parseParam } from '@kit/query';
import { assertNever } from '@kit/result';
import { environmentManager } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ShareTokenSchema, type Video, VideoIdParamSchema } from '@vp/api-contracts';
import { correctionsQueryOptions, prefetched } from '@vp/queries';
import { z } from 'zod';
import { ClipAction } from '#app/features/clips';
import { CreatorStatsPanel } from '#app/features/creator-stats';
import { SaveOfflineToggle } from '#app/features/offline';
import { ShareLinkExpired, WatchPage, WatchPasswordGate, WatchPending } from '#app/features/watch';
import { WEB_URL } from '#app/lib/config';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import { playlistQueryOptions } from '#app/lib/query-keys/library-keys';
import { relatedQueryOptions } from '#app/lib/query-keys/related-keys';
import { headWords } from '#app/lib/seo/head-words';
import { videoHead } from '#app/lib/seo/video-head';
import { loadVideoAccess } from '#app/lib/video-access/load-video-access';
import { validOrUndefined } from '#app/utils/valid-or-undefined';

const NonNegativeIntSchema = z.coerce.number().int().nonnegative();
const UuidSchema = z.uuid();

function EngagementActions({ video }: { video: Video }) {
  return (
    <>
      <SaveOfflineToggle video={video} />
      <ClipAction video={video} />
    </>
  );
}

function Watch() {
  const access = Route.useLoaderData();
  const { videoId } = Route.useParams();

  switch (access.kind) {
    case 'open':
      return (
        <WatchPage
          readOnServer={access.readOnServer}
          renderActions={(video) => <EngagementActions video={video} />}
          renderCreatorStats={(video) => <CreatorStatsPanel video={video} />}
        />
      );
    case 'password':
      return <WatchPasswordGate videoId={videoId} />;
    case 'expired':
      return <ShareLinkExpired />;
    default:
      return assertNever(access, 'watch access');
  }
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
    tab: validOrUndefined(z.enum(['comments', 'threads'])),
    thread: validOrUndefined(UuidSchema),
    s: validOrUndefined(ShareTokenSchema),
  }),
  loaderDeps: ({ search: { list, s } }) => ({ list, s }),
  loader: async ({ context: { queryClient, api }, params: { videoId }, deps: { list, s } }) => {
    const access = await loadVideoAccess(queryClient, api, videoId, s);
    if (access.kind !== 'open') return access;
    const { video } = access;
    await Promise.all([
      video.channel && prefetched(queryClient.query(channelQueryOptions(api, video.channel.id))),
      prefetched(queryClient.query(relatedQueryOptions(api, videoId))),
      prefetched(queryClient.query(correctionsQueryOptions(api, videoId, s))),
      list && prefetched(queryClient.query(playlistQueryOptions(api, list))),
    ]);
    return { ...access, readOnServer: environmentManager.isServer() };
  },
  head: ({ loaderData, match }) =>
    loaderData?.kind === 'open'
      ? videoHead(loaderData.video, WEB_URL, headWords(match.context.locales.snapshot()))
      : {},
  pendingComponent: WatchPending,
  component: Watch,
});

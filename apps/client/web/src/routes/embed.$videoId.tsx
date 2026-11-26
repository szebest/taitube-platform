import { parseParam } from '@kit/query';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { VideoIdParamSchema } from '@vp/api-contracts';
import { correctionsQueryOptions, prefetched } from '@vp/queries';
import {
  EmbedAccessGate,
  EmbedNotFound,
  EmbedPage,
  EmbedSearchSchema,
  isEmbeddable,
} from '#app/features/embed';
import { loadVideoAccess } from '#app/lib/video-access/load-video-access';

function Embed() {
  const access = Route.useLoaderData();
  const { videoId } = Route.useParams();
  const { s } = Route.useSearch();

  return access.kind === 'open' ? (
    <EmbedPage />
  ) : (
    <EmbedAccessGate kind={access.kind} videoId={videoId} shareToken={s} />
  );
}

export const Route = createFileRoute('/embed/$videoId')({
  params: {
    parse: ({ videoId }) => ({ videoId: parseParam(VideoIdParamSchema.shape.id, videoId) }),
    stringify: ({ videoId }) => ({ videoId }),
  },
  validateSearch: EmbedSearchSchema,
  loaderDeps: ({ search: { s } }) => ({ s }),
  loader: async ({ context: { queryClient, api }, params: { videoId }, deps: { s } }) => {
    const access = await loadVideoAccess(queryClient, api, videoId, s);
    if (access.kind !== 'open') return access;
    if (!isEmbeddable(access.video)) throw notFound();
    await prefetched(queryClient.query(correctionsQueryOptions(api, videoId, s)));
    return access;
  },
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }] }),
  notFoundComponent: EmbedNotFound,
  component: Embed,
});

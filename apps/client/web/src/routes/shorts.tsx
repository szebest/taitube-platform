import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ShortsPlayerFrameSkeleton } from '#app/components/shorts/shorts-player-frame';
import { ShortsPage } from '#app/features/shorts';
import { WatchCommentThread } from '#app/features/watch';
import { shortsFeedQueryOptions } from '#app/lib/query-keys/feed-keys';

function Shorts() {
  return (
    <ShortsPage
      renderComments={(videoId) => <WatchCommentThread videoId={videoId} layout="sheet" />}
    />
  );
}

export const Route = createFileRoute('/shorts')({
  validateSearch: z.object({}),
  loader: async ({ context: { queryClient, api } }) => {
    await queryClient.infiniteQuery({ ...shortsFeedQueryOptions(api), staleTime: 'static' });
  },
  head: () => ({ meta: [{ title: 'Shorts - Taitube' }] }),
  pendingComponent: ShortsPlayerFrameSkeleton,
  component: Shorts,
});

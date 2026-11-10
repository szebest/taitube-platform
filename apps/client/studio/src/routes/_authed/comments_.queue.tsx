import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import { z } from 'zod';
import { inboxQueryOptions, ModerationQueuePage } from '#app/features/comments';
import { useActiveChannel } from '#app/hooks/use-active-channel';

export const Route = createFileRoute('/_authed/comments_/queue')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    prefetched(queryClient.infiniteQuery(inboxQueryOptions(api, 'held'))),
  component: ModerationQueueRoute,
});

function ModerationQueueRoute() {
  const { channelId, ownerId } = useActiveChannel();

  return <ModerationQueuePage channel={{ channelId, ownerId }} />;
}

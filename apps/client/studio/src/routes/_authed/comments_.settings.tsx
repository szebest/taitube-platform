import { createFileRoute } from '@tanstack/react-router';
import { commentSettingsQueryOptions, prefetched } from '@vp/queries';
import { z } from 'zod';
import { CommentSettingsPage } from '#app/features/comments';
import { useActiveChannel } from '#app/hooks/use-active-channel';

export const Route = createFileRoute('/_authed/comments_/settings')({
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api } }) =>
    prefetched(queryClient.query(commentSettingsQueryOptions(api))),
  component: CommentSettingsRoute,
});

function CommentSettingsRoute() {
  const { channelId, ownerId } = useActiveChannel();

  return <CommentSettingsPage channel={{ channelId, ownerId }} />;
}

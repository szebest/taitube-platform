import { createFileRoute } from '@tanstack/react-router';
import { myCommentRemovalsQueryOptions } from '@vp/queries';
import { z } from 'zod';
import { ModerationPage, ModerationPageSkeleton } from '#app/features/library';

export const Route = createFileRoute('/_authed/feed/you_/moderation')({
  validateSearch: z.object({ channel: z.uuid().optional() }),
  loader: ({ context: { queryClient, api } }) =>
    queryClient.infiniteQuery({ ...myCommentRemovalsQueryOptions(api), staleTime: 'static' }),
  pendingComponent: ModerationPageSkeleton,
  component: ModerationPage,
});

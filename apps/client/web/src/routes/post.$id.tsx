import { parseParam } from '@kit/query';
import { createFileRoute } from '@tanstack/react-router';
import { getPost } from '@vp/api-contracts';
import { accountOf, ensureFound, postQueryOptions, postViewerKey } from '@vp/queries';
import { z } from 'zod';
import { PostFeedSkeleton } from '#app/components/posts/post-feed';
import { PostPage } from '#app/features/posts';

function Post() {
  const { id } = Route.useParams();
  return <PostPage postId={id} />;
}

export const Route = createFileRoute('/post/$id')({
  params: {
    parse: ({ id }) => ({ id: parseParam(getPost.params.shape.id, id) }),
    stringify: ({ id }) => ({ id }),
  },
  validateSearch: z.object({}),
  loader: ({ context: { queryClient, api, auth }, params: { id } }) =>
    ensureFound(
      queryClient,
      postQueryOptions(api, id, postViewerKey(accountOf(auth), auth.actingChannelId))
    ),
  pendingComponent: PostFeedSkeleton,
  component: Post,
});

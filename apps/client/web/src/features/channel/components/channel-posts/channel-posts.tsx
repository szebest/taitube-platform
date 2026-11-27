import { Button } from '@kit/ui';
import { canManagePost } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import {
  channelPostsQueryOptions,
  useAccount,
  useApi,
  useAppLink,
  usePostViewer,
} from '@vp/queries';
import { Suspense } from 'react';
import { PostFeed, PostFeedSkeleton } from '#app/components/posts/post-feed';
import { STUDIO_URL } from '#app/lib/config';
import { useT } from '#app/lib/messages';

/** A channel's Posts tab: the Create post link for the members who may post, and the posts, pinned first. */
export function ChannelPosts({ channelId }: { channelId: string }) {
  const api = useApi();
  const account = useAccount();
  const viewer = usePostViewer();
  const appLink = useAppLink();
  const { tOr } = useT();
  const canPost = useCan(canManagePost, {
    action: 'create',
    post: { channelId, ownerId: account?.channel.id === channelId ? account.id : '' },
  });

  return (
    <div className="flex flex-col gap-stack">
      {canPost && (
        <Button asChild variant="soft" className="self-start">
          <a href={appLink(STUDIO_URL, '/posts')}>{tOr('posts.createPost', {}, '')}</a>
        </Button>
      )}
      <Suspense fallback={<PostFeedSkeleton />}>
        <PostFeed
          options={channelPostsQueryOptions(api, channelId, viewer)}
          empty={tOr('posts.empty', {}, '')}
        />
      </Suspense>
    </div>
  );
}

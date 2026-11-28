import { PageHeader } from '@kit/components';
import { Callout } from '@kit/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { postQueryOptions, recordPostOpen, useApi, usePostViewer } from '@vp/queries';
import { Suspense, useEffect } from 'react';
import { PostItem } from '#app/components/posts/post-item';
import { CommentThreadSkeleton } from '#app/components/watch/comment-thread';
import { useT } from '#app/lib/messages';
import { PostReplies } from '../post-replies/post-replies';

/** `/post/$id`: the post, and under it the replies unless the channel turned them off. */
export function PostPage({ postId }: { postId: string }) {
  const api = useApi();
  const viewer = usePostViewer();
  const { tOr } = useT();
  const { data: post } = useSuspenseQuery(postQueryOptions(api, postId, viewer));

  useEffect(() => {
    void recordPostOpen(api, postId);
  }, [api, postId]);

  return (
    <section className="flex max-w-reading-max flex-col gap-6">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('posts.postBy', { channel: post.channel.displayName }, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <PostItem post={post} detail />
      {post.commentsEnabled ? (
        <Suspense fallback={<CommentThreadSkeleton />}>
          <PostReplies postId={post.id} />
        </Suspense>
      ) : (
        <Callout.Root>
          <Callout.Title>{tOr('posts.repliesOff', {}, '')}</Callout.Title>
        </Callout.Root>
      )}
    </section>
  );
}

import { Format, useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Button, Icon } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import type { PostView } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl-formats';
import { useFailureToast, useSetPostLike } from '@vp/queries';
import { PostCard } from '#app/components/posts/post-card';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useT } from '#app/lib/messages';
import { PostContent } from './components/post-content/post-content';

export interface PostItemProps {
  post: PostView;
  /** On the post's own page the replies are below, so the count is not a link. */
  detail?: boolean;
}

/** A post with its like, vote and replies wired: the card every list of posts draws. */
export function PostItem({ post, detail = false }: PostItemProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const showFailure = useFailureToast();
  const setLike = useSetPostLike();
  const { run } = useRequireAccount('like');

  const toggleLike = () =>
    run(() =>
      setLike.mutate(
        { postId: post.id, liked: !post.likedByViewer },
        { onError: (error) => showFailure(tOr('posts.likeFailed', {}, ''), error) }
      )
    );
  const replies = (
    <>
      <Icon name="chat" />
      <Format value={{ type: 'count', value: post.commentsCount }} />
    </>
  );

  return (
    <PostCard.Root channelName={post.channel.displayName}>
      <PostCard.Header
        channelId={post.channel.id}
        name={post.channel.displayName}
        avatarSrc={post.channel.avatarUrl ?? undefined}
        time={unwrapOr(format(publishedAt(post.publishedAt).relative), '')}
        dateTime={post.publishedAt}
      >
        {post.pinned && <PostCard.Pinned />}
        {post.isEdited && <PostCard.Edited />}
      </PostCard.Header>
      <PostCard.Body>
        <PostContent post={post} />
      </PostCard.Body>
      <PostCard.Actions>
        <Button
          variant="ghost"
          tone={post.likedByViewer ? 'accent' : 'neutral'}
          aria-pressed={post.likedByViewer}
          aria-label={tOr(post.likedByViewer ? 'posts.unlike' : 'posts.like', {}, '')}
          onClick={toggleLike}
        >
          <Icon name="heart" />
          <Format value={{ type: 'count', value: post.likeCount }} />
        </Button>
        {post.commentsEnabled &&
          (detail ? (
            <span className="inline-flex items-center gap-inline px-inset-control text-label text-fg-muted">
              {replies}
            </span>
          ) : (
            <Button asChild variant="ghost" tone="neutral">
              <Link
                to="/post/$id"
                params={{ id: post.id }}
                aria-label={tOr('posts.replyCount', { count: post.commentsCount }, '')}
              >
                {replies}
              </Link>
            </Button>
          ))}
      </PostCard.Actions>
    </PostCard.Root>
  );
}

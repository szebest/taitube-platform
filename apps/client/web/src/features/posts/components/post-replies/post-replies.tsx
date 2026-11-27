import { EmptyState } from '@kit/components';
import { Format, useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Button } from '@kit/ui';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import type { CommentSort } from '@vp/domain';
import { publishedAt } from '@vp/intl-formats';
import { useCan } from '@vp/permissions-react';
import {
  postCommentsQueryOptions,
  useAccount,
  useApi,
  useFailureToast,
  useReplyToPost,
} from '@vp/queries';
import { useState } from 'react';
import { CommentItem } from '#app/components/discussion/comment-item';
import { CommentThread } from '#app/components/watch/comment-thread';
import { useRequireAccount } from '#app/hooks/use-require-account';
import { useT } from '#app/lib/messages';

function SignInPrompt() {
  const { tOr } = useT();
  const { run } = useRequireAccount('comment');

  return (
    <div className="flex flex-wrap items-center gap-stack">
      <p className="m-0 text-body">{tOr('watch.discussionSignIn', {}, '')}</p>
      <Button variant="soft" onClick={() => run(() => undefined)}>
        {tOr('auth.signIn', {}, '')}
      </Button>
    </div>
  );
}

function Replies({ postId }: { postId: string }) {
  const api = useApi();
  const account = useAccount();
  const { tOr } = useT();
  const { format } = useFormat();
  const showFailure = useFailureToast();
  const [sort, setSort] = useState<CommentSort>('top');
  const [text, setText] = useState('');
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    postCommentsQueryOptions(api, postId, sort)
  );
  const reply = useReplyToPost(postId);
  const canReply = useCan('create', 'Comment');
  const comments = data.pages.flatMap((page) => page.items);
  const total = data.pages.at(-1)?.total ?? 0;

  const send = () =>
    reply.mutate(
      { content: text.trim() },
      {
        onSuccess: () => setText(''),
        onError: (error) => showFailure(tOr('posts.replyFailed', {}, ''), error, send),
      }
    );

  return (
    <CommentThread.Root sort={sort} onSortChange={setSort}>
      <CommentThread.Header>
        {tOr('posts.repliesTitle', {}, '')}
        {' · '}
        <Format value={{ type: 'count', value: total }} />
      </CommentThread.Header>
      {canReply ? (
        <CommentThread.Composer
          value={text}
          onChange={setText}
          onSubmit={send}
          submitting={reply.isPending}
          viewerAvatar={account?.channel.avatarUrl ?? undefined}
        />
      ) : (
        <SignInPrompt />
      )}
      {comments.length === 0 ? (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('posts.repliesEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      ) : (
        <CommentThread.List>
          {comments.map((comment) => (
            <CommentThread.Item key={comment.id}>
              <CommentItem.Root>
                {comment.isPinned && <CommentItem.Pinned />}
                <CommentItem.Author
                  name={comment.author.displayName ?? comment.author.handle ?? ''}
                  avatarSrc={comment.author.avatarUrl ?? undefined}
                  time={unwrapOr(format(publishedAt(comment.createdAt).relative), '')}
                  dateTime={comment.createdAt}
                  creator={comment.author.isCreator}
                  edited={comment.isEdited}
                />
                <CommentItem.Body>{comment.content}</CommentItem.Body>
              </CommentItem.Root>
            </CommentThread.Item>
          ))}
        </CommentThread.List>
      )}
      {hasNextPage && (
        <CommentThread.More loading={isFetchingNextPage} onClick={() => fetchNextPage()} />
      )}
    </CommentThread.Root>
  );
}

/** The replies under a post: the composer, the root comments and Show more. */
export function PostReplies({ postId }: { postId: string }) {
  return <Replies key={postId} postId={postId} />;
}

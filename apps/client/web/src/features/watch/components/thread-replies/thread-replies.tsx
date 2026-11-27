import { EmptyState } from '@kit/components';
import { Format, useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import type { CommentSort } from '@vp/domain';
import { publishedAt } from '@vp/intl-formats';
import { useCan } from '@vp/permissions-react';
import {
  SectionBoundary,
  threadCommentsQueryOptions,
  useAccount,
  useApi,
  useFailureToast,
  useReplyInThread,
} from '@vp/queries';
import { Suspense, useState } from 'react';
import { CommentItem } from '#app/components/discussion/comment-item';
import { CommentThread, CommentThreadSkeleton } from '#app/components/watch/comment-thread';
import { useT } from '#app/lib/messages';
import { SignInPrompt } from '../sign-in-prompt/sign-in-prompt';

function Replies({ threadId }: { threadId: string }) {
  const api = useApi();
  const account = useAccount();
  const { tOr } = useT();
  const { format } = useFormat();
  const showFailure = useFailureToast();
  const [sort, setSort] = useState<CommentSort>('top');
  const [text, setText] = useState('');
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    threadCommentsQueryOptions(api, threadId, sort)
  );
  const reply = useReplyInThread(threadId);
  const canReply = useCan('create', 'Comment');
  const comments = data.pages.flatMap((page) => page.items);
  const total = data.pages.at(-1)?.total ?? 0;

  const send = () =>
    reply.mutate(
      { content: text.trim() },
      {
        onSuccess: () => setText(''),
        onError: (error) => showFailure(tOr('threads.replyFailed', {}, ''), error, send),
      }
    );

  return (
    <CommentThread.Root layout="sheet" sort={sort} onSortChange={setSort}>
      <CommentThread.Header>
        {tOr('threads.repliesTitle', {}, '')}
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
          <EmptyState.Title>{tOr('threads.repliesEmpty', {}, '')}</EmptyState.Title>
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

export interface ThreadRepliesProps {
  threadId: string;
}

/** The replies under a thread: the composer, the root comments and Show more; a failure stays in the section. */
export function ThreadReplies({ threadId }: ThreadRepliesProps) {
  const { tOr } = useT();

  return (
    <SectionBoundary
      message={tOr('threads.repliesFailed', {}, '')}
      resetKey={threadId}
      layout="block"
    >
      <Suspense fallback={<CommentThreadSkeleton />}>
        <Replies key={threadId} threadId={threadId} />
      </Suspense>
    </SectionBoundary>
  );
}

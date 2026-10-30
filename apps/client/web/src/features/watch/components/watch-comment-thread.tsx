import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { EmptyState } from '@vp/components';
import type { CommentSort } from '@vp/domain';
import { Format, useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { SectionBoundary, useAccount, useApi } from '@vp/queries';
import { Button } from '@vp/ui';
import { Suspense, useDeferredValue, useState } from 'react';

import { CommentItem } from '#app/components/discussion/comment-item';
import {
  CommentThread,
  type CommentThreadLayout,
  CommentThreadSkeleton,
} from '#app/components/watch/comment-thread';

import { commentsQueryOptions } from '../api/comment-queries';
import { type NewComment, usePostComment } from '../hooks/use-post-comment';
import { NearViewport } from './near-viewport';
import { VideoCommentItem } from './video-comment-item';

function SignInPrompt() {
  const { tOr } = useT();
  const redirect = useLocation({ select: ({ href }) => href });

  return (
    <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-stack">
      <p className="tw:m-0 tw:text-body">{tOr('watch.discussionSignIn', {}, '')}</p>
      <Button asChild variant="soft">
        <Link to="/login" search={{ redirect }}>
          {tOr('auth.signIn', {}, '')}
        </Link>
      </Button>
    </div>
  );
}

function DraftComment({ draft, onRetry, onDiscard }: DraftProps) {
  const account = useAccount();

  return (
    <CommentItem.Root state={draft.status}>
      <CommentItem.Author
        name={account?.channel?.displayName ?? account?.email ?? ''}
        avatarSrc={account?.channel?.avatarUrl ?? undefined}
        time=""
        dateTime={draft.postedAt}
      />
      <CommentItem.Body>{draft.content}</CommentItem.Body>
      <CommentItem.Failed onRetry={onRetry} onDelete={onDiscard} />
    </CommentItem.Root>
  );
}

interface DraftProps {
  draft: { status: 'pending' | 'failed'; content: string; postedAt: string };
  onRetry: () => void;
  onDiscard: () => void;
}

function CommentSection({ videoId, layout }: { videoId: string; layout: CommentThreadLayout }) {
  const api = useApi();
  const { tOr } = useT();
  const account = useAccount();
  const [sort, setSort] = useState<CommentSort>('top');
  const [text, setText] = useState('');
  const shownSort = useDeferredValue(sort);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    commentsQueryOptions(api, videoId, shownSort)
  );
  const post = usePostComment(videoId);
  const canComment = useCan('create', 'Comment');

  const comments = data.pages
    .flatMap((page) => page.items)
    .toSorted((first, second) => Number(second.isPinned) - Number(first.isPinned));
  const total = data.pages.at(-1)?.total ?? 0;
  const draft = post.variables;

  const submit = () => {
    post.mutate({ content: text.trim() });
    setText('');
  };
  const retry = (variables: NewComment) => post.mutate(variables);

  return (
    <CommentThread.Root layout={layout} sort={sort} onSortChange={setSort}>
      <CommentThread.Header>
        {tOr('watch.discussion', {}, '')}
        {' · '}
        <Format value={{ type: 'count', value: total }} />
      </CommentThread.Header>
      {canComment ? (
        <CommentThread.Composer
          value={text}
          onChange={setText}
          onSubmit={submit}
          viewerAvatar={account?.channel?.avatarUrl ?? undefined}
          submitting={post.isPending}
        />
      ) : (
        <SignInPrompt />
      )}
      {comments.length === 0 && !draft ? (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('watch.discussionEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      ) : (
        <CommentThread.List busy={sort !== shownSort}>
          {draft && !post.isSuccess && (
            <CommentThread.Item>
              <DraftComment
                draft={{
                  status: post.isError ? 'failed' : 'pending',
                  content: draft.content,
                  postedAt: new Date(post.submittedAt).toISOString(),
                }}
                onRetry={() => retry(draft)}
                onDiscard={post.reset}
              />
            </CommentThread.Item>
          )}
          {comments.map((comment) => (
            <CommentThread.Item key={comment.id}>
              <VideoCommentItem comment={comment} />
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

export interface WatchCommentThreadProps {
  videoId: string;
  /** `sheet` fills a drawer and scrolls its own list. */
  layout?: CommentThreadLayout;
}

/** The discussion under a video: its query waits until the section nears the viewport, and a failure stays in it. */
export function WatchCommentThread({ videoId, layout = 'inline' }: WatchCommentThreadProps) {
  const { tOr } = useT();

  return (
    <NearViewport fallback={<CommentThreadSkeleton />}>
      <SectionBoundary
        message={tOr('watch.discussionFailed', {}, '')}
        resetKey={videoId}
        layout="block"
        className="tw:min-h-[37rem]"
      >
        <Suspense fallback={<CommentThreadSkeleton />}>
          <CommentSection key={videoId} videoId={videoId} layout={layout} />
        </Suspense>
      </SectionBoundary>
    </NearViewport>
  );
}

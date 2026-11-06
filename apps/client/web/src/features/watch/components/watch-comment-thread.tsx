import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { Link, useLocation } from '@tanstack/react-router';
import { EmptyState } from '@vp/components';
import type { CommentSort } from '@vp/domain';
import { Format, useT } from '@vp/intl-react';
import { useCan } from '@vp/permissions-react';
import { SectionBoundary, useAccount, useApi } from '@vp/queries';
import { Button } from '@vp/ui';
import { Suspense, useDeferredValue, useRef, useState } from 'react';
import { CommentItem } from '#app/components/discussion/comment-item';
import {
  CommentThread,
  type CommentThreadLayout,
  CommentThreadSkeleton,
} from '#app/components/watch/comment-thread';
import { useWindowRows } from '#app/hooks/use-window-rows';
import { commentsQueryOptions } from '../api/comment-queries';
import { type NewComment, usePostComment } from '../hooks/use-post-comment';
import { NearViewport } from './near-viewport';
import { VideoCommentItem } from './video-comment-item';

const ESTIMATED_COMMENT_HEIGHT = 110;

const toggled = (held: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> => {
  if (held.has(id) === on) {
    return held;
  }
  const next = new Set(held);
  if (on) {
    next.add(id);
  } else {
    next.delete(id);
  }
  return next;
};

function SignInPrompt() {
  const { tOr } = useT();
  const redirect = useLocation({ select: ({ href }) => href });

  return (
    <div className="flex flex-wrap items-center gap-stack">
      <p className="m-0 text-body">{tOr('watch.discussionSignIn', {}, '')}</p>
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
  const list = useRef<HTMLUListElement>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [engaged, setEngaged] = useState<ReadonlySet<string>>(new Set());
  const [focused, setFocused] = useState<string | null>(null);

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    commentsQueryOptions(api, videoId, shownSort)
  );
  const post = usePostComment(videoId);
  const canComment = useCan('create', 'Comment');

  const comments = data.pages
    .flatMap((page) => page.items)
    .toSorted((first, second) => Number(second.isPinned) - Number(first.isPinned));
  const pinned = comments.flatMap(({ id }, index) =>
    engaged.has(id) || focused === id ? [index] : []
  );
  const { rows, padding, measureRow } = useWindowRows({
    list,
    rowCount: comments.length,
    estimateRowHeight: ESTIMATED_COMMENT_HEIGHT,
    getRowKey: (row) => comments[row]?.id ?? String(row),
    scroller: layout === 'sheet' ? list : undefined,
    pinned,
  });
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
        <>
          {draft && !post.isSuccess && (
            <CommentThread.List className="flex-none overflow-visible">
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
            </CommentThread.List>
          )}
          <CommentThread.List ref={list} busy={sort !== shownSort} style={padding}>
            {rows.map(({ index, key, spaceBefore }) => {
              const comment = comments[index];

              return (
                comment && (
                  <CommentThread.Item
                    key={key}
                    ref={measureRow}
                    data-index={index}
                    style={spaceBefore > 0 ? { marginTop: spaceBefore } : undefined}
                    onFocus={() => setFocused(comment.id)}
                    onBlur={() => setFocused(null)}
                  >
                    <VideoCommentItem
                      comment={comment}
                      expanded={expanded.has(comment.id)}
                      onExpandedChange={(open) =>
                        setExpanded((held) => toggled(held, comment.id, open))
                      }
                      onEngagedChange={(open) =>
                        setEngaged((held) => toggled(held, comment.id, open))
                      }
                    />
                  </CommentThread.Item>
                )
              );
            })}
          </CommentThread.List>
        </>
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
        className="min-h-[37rem]"
      >
        <Suspense fallback={<CommentThreadSkeleton />}>
          <CommentSection key={videoId} videoId={videoId} layout={layout} />
        </Suspense>
      </SectionBoundary>
    </NearViewport>
  );
}

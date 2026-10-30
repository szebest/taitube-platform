import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { CommentView } from '@vp/api-contracts';
import { threadRootId } from '@vp/domain';
import { publishedAt } from '@vp/intl';
import { useFormat, useT } from '@vp/intl-react';
import { canDeleteComment, canUpdateComment } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useApi, videoQueryOptions } from '@vp/queries';
import { unwrapOr } from '@vp/result';
import { DropdownMenu, Icon, useToast, useUiCopy } from '@vp/ui';
import { Suspense, useState } from 'react';

import { CommentItem, CommentItemSkeleton } from '#app/components/discussion/comment-item';
import { CommentThread } from '#app/components/watch/comment-thread';
import { usePlayerSeek } from '#app/features/player';

import { repliesQueryOptions } from '../api/comment-queries';
import { useDeleteComment } from '../hooks/use-delete-comment';
import { useEditComment } from '../hooks/use-edit-comment';
import { usePostComment } from '../hooks/use-post-comment';
import { type DescriptionToken, tokenizeDescription } from '../timecodes';
import { CommentEditor } from './comment-editor';
import { SectionBoundary } from './section-boundary';

type Mode = 'view' | 'editing' | 'replying';

function CommentPart({ token }: { token: DescriptionToken }) {
  const { seek } = usePlayerSeek();

  switch (token.type) {
    case 'text':
      return token.text;
    case 'link':
      return (
        <a href={token.href} target="_blank" rel="noopener noreferrer nofollow">
          {token.text}
        </a>
      );
    case 'time':
      return (
        <CommentItem.Timecode seconds={token.seconds} onSeek={seek}>
          {token.text}
        </CommentItem.Timecode>
      );
  }
}

interface ReplyThreadProps {
  comment: CommentView;
  expanded: boolean;
  onToggle: () => void;
}

function ExpandedReplies({ comment, expanded, onToggle }: ReplyThreadProps) {
  const api = useApi();
  const { tOr } = useT();
  const { format } = useFormat();
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useSuspenseInfiniteQuery(
    repliesQueryOptions(api, comment.id)
  );

  return (
    <>
      <CommentItem.Replies
        count={unwrapOr(format({ type: 'count', value: comment.replyCount }), '')}
        expanded={expanded}
        onToggle={onToggle}
      >
        {data.pages
          .flatMap((page) => page.items)
          .map((reply) => (
            <VideoCommentItem key={reply.id} comment={reply} />
          ))}
      </CommentItem.Replies>
      {hasNextPage && (
        <CommentThread.More
          loading={isFetchingNextPage}
          className="tw:col-start-2 tw:self-start"
          onClick={() => fetchNextPage()}
        >
          {tOr('watch.showMoreReplies', {}, '')}
        </CommentThread.More>
      )}
    </>
  );
}

function ReplyThread(props: ReplyThreadProps) {
  const { comment, expanded, onToggle } = props;
  const { tOr } = useT();
  const { format } = useFormat();
  const count = unwrapOr(format({ type: 'count', value: comment.replyCount }), '');

  if (!expanded) {
    return <CommentItem.Replies count={count} expanded={false} onToggle={onToggle} />;
  }

  return (
    <SectionBoundary message={tOr('watch.repliesFailed', {}, '')} resetKey={comment.id}>
      <Suspense
        fallback={
          <CommentItem.Replies count={count} expanded onToggle={onToggle}>
            <CommentItemSkeleton />
          </CommentItem.Replies>
        }
      >
        <ExpandedReplies {...props} />
      </Suspense>
    </SectionBoundary>
  );
}

export interface VideoCommentItemProps {
  comment: CommentView;
}

/** One comment with its reply thread; edit and delete follow what the viewer's permissions allow. */
export function VideoCommentItem({ comment }: VideoCommentItemProps) {
  const api = useApi();
  const { tOr } = useT();
  const { format } = useFormat();
  const showToast = useToast();
  const { reply: replyLabel, delete: deleteLabel } = useUiCopy();
  const [mode, setMode] = useState<Mode>('view');
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState('');

  const { data: video } = useSuspenseQuery(videoQueryOptions(api, comment.videoId));
  const editComment = useEditComment(comment.id);
  const deleteComment = useDeleteComment(comment.id);
  const postReply = usePostComment(comment.videoId);
  const target = { id: comment.id, authorId: comment.author.userId };
  const canReply = useCan('create', 'Comment');
  const canEdit = useCan(canUpdateComment, { comment: target });
  const canDelete = useCan(canDeleteComment, { comment: target, videoOwnerId: video.ownerId });

  const level = comment.parentId === null ? 'comment' : 'reply';
  const state = deleteComment.isSuccess ? 'deleted' : mode === 'editing' ? 'editing' : 'view';
  const failed = (message: string) => () => showToast({ tone: 'danger', title: message });

  const saveEdit = (content: string) =>
    editComment.mutate(content, {
      onSuccess: () => setMode('view'),
      onError: failed(tOr('watch.commentEditFailed', {}, '')),
    });
  const removeComment = () =>
    deleteComment.mutate(undefined, { onError: failed(tOr('watch.commentDeleteFailed', {}, '')) });
  const sendReply = () =>
    postReply.mutate(
      { content: draft.trim(), parentId: threadRootId(comment) },
      {
        onSuccess: () => {
          setDraft('');
          setMode('view');
          setExpanded(true);
        },
        onError: failed(tOr('watch.commentFailed', {}, '')),
      }
    );

  return (
    <CommentItem.Root level={level} state={state}>
      {comment.isPinned && <CommentItem.Pinned />}
      <CommentItem.Author
        name={comment.author.displayName ?? comment.author.handle ?? ''}
        avatarSrc={comment.author.avatarUrl ?? undefined}
        time={unwrapOr(format(publishedAt(comment.createdAt).relative), '')}
        dateTime={comment.createdAt}
        creator={comment.author.isCreator}
        edited={comment.isEdited}
      />
      <CommentItem.Body>
        {mode === 'editing' ? (
          <CommentEditor
            initial={comment.content}
            saving={editComment.isPending}
            onSave={saveEdit}
            onCancel={() => setMode('view')}
          />
        ) : (
          tokenizeDescription(comment.content).map((token) => (
            <CommentPart key={token.start} token={token} />
          ))
        )}
      </CommentItem.Body>
      <CommentItem.Actions>
        {canReply && <CommentItem.Reply onClick={() => setMode('replying')} />}
        {(canEdit || canDelete) && (
          <CommentItem.Menu>
            {canEdit && (
              <DropdownMenu.Item onSelect={() => setMode('editing')}>
                <Icon name="edit" />
                {tOr('watch.editComment', {}, '')}
              </DropdownMenu.Item>
            )}
            {canDelete && (
              <DropdownMenu.Item tone="danger" onSelect={removeComment}>
                <Icon name="trash" />
                {deleteLabel}
              </DropdownMenu.Item>
            )}
          </CommentItem.Menu>
        )}
      </CommentItem.Actions>
      {mode === 'replying' && state === 'view' && (
        <div className="tw:col-start-2">
          <CommentThread.Composer
            value={draft}
            onChange={setDraft}
            onSubmit={sendReply}
            submitting={postReply.isPending}
            aria-label={replyLabel}
          />
        </div>
      )}
      {level === 'comment' && comment.replyCount > 0 && state !== 'deleted' && (
        <ReplyThread
          comment={comment}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
      )}
    </CommentItem.Root>
  );
}

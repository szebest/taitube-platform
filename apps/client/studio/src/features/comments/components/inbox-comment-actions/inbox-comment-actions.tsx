import { useT } from '@vp/intl-react';
import { useFailureToast, useHeartComment, usePinComment, useTrustCommenter } from '@vp/queries';
import { Button, Icon, IconButton, useToast } from '@vp/ui';
import type { InboxComment } from '#app/features/comments/api/inbox-queries';

export interface InboxCommentActionsProps {
  comment: InboxComment;
  onReply: () => void;
}

/** Reply, heart and, on a top-level comment, pin: what the creator does with one inbox row. */
export function InboxCommentActions({ comment, onReply }: InboxCommentActionsProps) {
  const { tOr } = useT();
  const showFailure = useFailureToast();
  const heartComment = useHeartComment();
  const pinComment = usePinComment();
  const trustCommenter = useTrustCommenter();
  const showToast = useToast();

  const hearted = heartComment.isPending
    ? heartComment.variables.hearted
    : comment.heartedByCreator;
  const pinned = pinComment.isPending ? pinComment.variables.pinned : comment.isPinned;

  const toggleHeart = () =>
    heartComment.mutate(
      { commentId: comment.id, hearted: !hearted },
      { onError: (error) => showFailure(tOr('studio.commentsHeartFailed', {}, ''), error) }
    );
  const togglePin = () =>
    pinComment.mutate(
      { commentId: comment.id, pinned: !pinned },
      { onError: (error) => showFailure(tOr('studio.commentsPinFailed', {}, ''), error) }
    );

  const trustAuthor = () =>
    trustCommenter.mutate(
      { userId: comment.author.userId, trusted: true },
      {
        onSuccess: () =>
          showToast({ tone: 'success', title: tOr('studio.settingsTrustAuthorDone', {}, '') }),
        onError: (error) =>
          showFailure(tOr('studio.settingsTrustAuthorFailed', {}, ''), error, trustAuthor),
      }
    );

  return (
    <span className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={onReply}>
        {tOr('studio.commentsReply', {}, '')}
      </Button>
      <Button variant="ghost" size="sm" loading={trustCommenter.isPending} onClick={trustAuthor}>
        {tOr('studio.settingsTrustAuthor', {}, '')}
      </Button>
      <IconButton
        size="sm"
        aria-label={tOr('studio.commentsHeart', {}, '')}
        aria-pressed={hearted}
        onClick={toggleHeart}
      >
        <Icon
          name="heart"
          tone={hearted ? 'danger' : 'inherit'}
          className={hearted ? 'fill-current' : undefined}
        />
      </IconButton>
      {comment.parentId === null && (
        <IconButton
          size="sm"
          aria-label={tOr('studio.commentsPin', {}, '')}
          aria-pressed={pinned}
          onClick={togglePin}
        >
          <Icon name="pin" tone={pinned ? 'accent' : 'inherit'} />
        </IconButton>
      )}
    </span>
  );
}

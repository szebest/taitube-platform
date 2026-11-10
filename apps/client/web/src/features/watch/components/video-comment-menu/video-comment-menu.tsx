import type { CommentView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { canDeleteComment, canPinComment, canUpdateComment } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { DropdownMenu, Icon, useUiCopy } from '@vp/ui';
import { useState } from 'react';
import { CommentItem } from '#app/components/discussion/comment-item';
import { useCommentModeration } from '#app/features/watch/hooks/use-comment-moderation';
import {
  type ModerationChoice,
  useModerationChoices,
} from '#app/features/watch/hooks/use-moderation-choices';
import { useRequireAccount } from '#app/hooks/use-require-account';
import type { ModerationDialogAction } from '../moderation-dialog/moderation-dialog';
import { LazyModerationDialog } from '../moderation-dialog/moderation-dialog.lazy';

export interface VideoCommentMenuProps {
  comment: CommentView;
  videoOwnerId: string;
  /** The video's channel, which moderation acts on. */
  channelId: string | undefined;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}

const DIALOG_ACTIONS: ReadonlySet<ModerationChoice> = new Set([
  'hold',
  'hide',
  'remove',
  'shadow_ban',
  'ban',
]);

const isDialogAction = (choice: ModerationChoice): choice is ModerationDialogAction =>
  DIALOG_ACTIONS.has(choice);

/** The actions the viewer may take on one comment; no menu at all when there are none. */
export function VideoCommentMenu({
  comment,
  videoOwnerId,
  channelId,
  onEdit,
  onDelete,
  onReport,
}: VideoCommentMenuProps) {
  const { tOr } = useT();
  const { delete: deleteLabel } = useUiCopy();
  const [dialog, setDialog] = useState<{ action: ModerationDialogAction; open: boolean }>();
  const target = { id: comment.id, authorId: comment.author.userId };
  const canEdit = useCan(canUpdateComment, { comment: target });
  const canDelete = useCan(canDeleteComment, { comment: target, videoOwnerId });
  const report = useRequireAccount('report');
  const canReport = !canEdit;
  const canPin =
    useCan(canPinComment, { videoOwnerId }) &&
    comment.parentId === null &&
    comment.status === 'published';
  const choices = useModerationChoices(comment, { videoOwnerId, channelId });
  const { togglePin, run } = useCommentModeration(comment, channelId);

  if (!(canEdit || canDelete || canReport || canPin || choices.length > 0)) return null;

  const choose = (choice: ModerationChoice) => {
    if (isDialogAction(choice)) {
      setDialog({ action: choice, open: true });
    } else {
      run(choice);
    }
  };

  return (
    <>
      <CommentItem.Menu>
        {canEdit && (
          <DropdownMenu.Item onSelect={onEdit}>
            <Icon name="edit" />
            {tOr('watch.editComment', {}, '')}
          </DropdownMenu.Item>
        )}
        {canPin && (
          <DropdownMenu.Item onSelect={togglePin}>
            <Icon name="pin" />
            {tOr(comment.isPinned ? 'watch.unpinComment' : 'watch.pinComment', {}, '')}
          </DropdownMenu.Item>
        )}
        {canDelete && (
          <DropdownMenu.Item tone="danger" onSelect={onDelete}>
            <Icon name="trash" />
            {deleteLabel}
          </DropdownMenu.Item>
        )}
        {canReport && (
          <DropdownMenu.Item onSelect={() => report.run(onReport)}>
            <Icon name="alert" />
            {tOr('watch.reportComment', {}, '')}
          </DropdownMenu.Item>
        )}
        {choices.length > 0 && (
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              <Icon name="shield" />
              {tOr('watch.moderate', {}, '')}
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              {choices.map((choice) => (
                <DropdownMenu.Item
                  key={choice}
                  tone={choice === 'remove' || choice === 'ban' ? 'danger' : undefined}
                  onSelect={() => choose(choice)}
                >
                  {tOr('watch.moderateAction', { action: choice }, '')}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        )}
      </CommentItem.Menu>
      {dialog && channelId && (
        <LazyModerationDialog
          key={dialog.action}
          comment={comment}
          action={dialog.action}
          channel={{ channelId, ownerId: videoOwnerId }}
          open={dialog.open}
          onOpenChange={(open) => setDialog({ action: dialog.action, open })}
        />
      )}
    </>
  );
}

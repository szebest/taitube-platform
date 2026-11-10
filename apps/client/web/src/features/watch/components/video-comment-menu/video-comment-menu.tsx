import type { CommentView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { canDeleteComment, canReportComment, canUpdateComment } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { DropdownMenu, Icon, useUiCopy } from '@vp/ui';
import { CommentItem } from '#app/components/discussion/comment-item';

export interface VideoCommentMenuProps {
  comment: CommentView;
  videoOwnerId: string;
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
}

/** The actions the viewer may take on one comment; no menu at all when there are none. */
export function VideoCommentMenu({
  comment,
  videoOwnerId,
  onEdit,
  onDelete,
  onReport,
}: VideoCommentMenuProps) {
  const { tOr } = useT();
  const { delete: deleteLabel } = useUiCopy();
  const target = { id: comment.id, authorId: comment.author.userId };
  const canEdit = useCan(canUpdateComment, { comment: target });
  const canDelete = useCan(canDeleteComment, { comment: target, videoOwnerId });
  const canReport = useCan(canReportComment) && !canEdit;

  if (!(canEdit || canDelete || canReport)) return null;

  return (
    <CommentItem.Menu>
      {canEdit && (
        <DropdownMenu.Item onSelect={onEdit}>
          <Icon name="edit" />
          {tOr('watch.editComment', {}, '')}
        </DropdownMenu.Item>
      )}
      {canDelete && (
        <DropdownMenu.Item tone="danger" onSelect={onDelete}>
          <Icon name="trash" />
          {deleteLabel}
        </DropdownMenu.Item>
      )}
      {canReport && (
        <DropdownMenu.Item onSelect={onReport}>
          <Icon name="alert" />
          {tOr('watch.reportComment', {}, '')}
        </DropdownMenu.Item>
      )}
    </CommentItem.Menu>
  );
}

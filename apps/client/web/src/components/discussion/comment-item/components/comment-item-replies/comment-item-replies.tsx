import { Button, Icon } from '@kit/ui';
import { Children, type ReactNode, useId } from 'react';
import { useCommentItem } from '#app/components/discussion/comment-item/comment-item.context';
import { commentItemStyles } from '#app/components/discussion/comment-item/comment-item.variants';
import { useT } from '#app/lib/messages';

export interface CommentItemRepliesProps {
  /** The reply count, formatted by the app. */
  count: string;
  expanded: boolean;
  onToggle: () => void;
  /** The replies, each a `CommentItem.Root` at `level="reply"`. */
  children?: ReactNode;
}

/** The toggle and the nested list of replies; a reply has none. */
export function CommentItemReplies({
  count,
  expanded,
  onToggle,
  children,
}: CommentItemRepliesProps) {
  const { level } = useCommentItem('Replies');
  const { tOr } = useT();
  const panelId = useId();
  const styles = commentItemStyles();

  if (level === 'reply') return null;

  return (
    <div data-slot="comment-item-replies" className={styles.replies()}>
      <Button
        variant="ghost"
        tone="accent"
        size="sm"
        aria-expanded={expanded}
        aria-controls={panelId}
        className="-ms-inline"
        onClick={onToggle}
      >
        <Icon name="chevron-down" className={expanded ? 'rotate-180' : undefined} />
        {expanded ? tOr('appUi.hideReplies', {}, '') : tOr('appUi.viewReplies', { count }, '')}
      </Button>
      <ul id={panelId} hidden={!expanded} className={styles.repliesList()}>
        {expanded && Children.map(children, (reply) => <li>{reply}</li>)}
      </ul>
    </div>
  );
}

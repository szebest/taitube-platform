import { Button, Icon, useUiCopy } from '@vp/ui';
import { Children, type ReactNode, useId } from 'react';

import { useCommentItem } from './comment-item.context';
import { commentItemStyles } from './comment-item.variants';

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
  const { viewReplies, hideReplies } = useUiCopy();
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
        className="tw:-ms-inline"
        onClick={onToggle}
      >
        <Icon name="chevron-down" className={expanded ? 'tw:rotate-180' : undefined} />
        {expanded ? hideReplies : viewReplies.replace('{count}', count)}
      </Button>
      <ul id={panelId} hidden={!expanded} className={styles.repliesList()}>
        {expanded && Children.map(children, (reply) => <li>{reply}</li>)}
      </ul>
    </div>
  );
}

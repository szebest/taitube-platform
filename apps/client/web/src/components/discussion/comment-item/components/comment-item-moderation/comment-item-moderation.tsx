import { Badge, useUiCopy } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import { useCommentItem } from '#app/components/discussion/comment-item/comment-item.context';
import { commentItemStyles } from '#app/components/discussion/comment-item/comment-item.variants';

export interface CommentItemModerationProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  /** Why it was held or hidden, in the viewer's words; absent when the author is not told. */
  reason?: string;
  /** A moderator's view of an action the author was not told about. */
  silent?: boolean;
}

/** What moderation did to the comment, under the author line: shown for the `held` and `hidden` states only. */
export function CommentItemModeration({
  reason,
  silent = false,
  className,
  ...props
}: CommentItemModerationProps) {
  const { state } = useCommentItem('Moderation');
  const { commentHeld, commentHidden, commentSilent } = useUiCopy();

  if (state !== 'held' && state !== 'hidden') return null;

  const styles = commentItemStyles();

  return (
    <div
      data-slot="comment-item-moderation"
      className={styles.moderation({ className })}
      {...props}
    >
      <Badge size="sm" tone={state === 'held' ? 'warning' : 'neutral'}>
        {state === 'held' ? commentHeld : commentHidden}
      </Badge>
      {reason && <span>{reason}</span>}
      {silent && <span className={styles.silent()}>{commentSilent}</span>}
    </div>
  );
}

import { Button } from '@kit/ui';
import { type ComponentPropsWithRef, useState } from 'react';
import { useCommentItem } from '#app/components/discussion/comment-item/comment-item.context';
import { commentItemStyles } from '#app/components/discussion/comment-item/comment-item.variants';
import { useClamped } from '#app/components/discussion/comment-item/hooks/use-clamped';
import { useT } from '#app/lib/messages';

/** The text, tokenised by the app; long text collapses to six lines with Read more. */
export function CommentItemBody({ className, children, ...props }: ComponentPropsWithRef<'div'>) {
  const { state } = useCommentItem('Body');
  const { tOr } = useT();
  const [open, setOpen] = useState(false);
  const { clamped, measure } = useClamped();
  const styles = commentItemStyles({ state });

  if (state === 'deleted' || state === 'removed') {
    return (
      <p data-slot="comment-item-body" className={styles.gone({ className })}>
        {state === 'deleted'
          ? tOr('appUi.commentDeleted', {}, '')
          : tOr('appUi.commentRemoved', {}, '')}
      </p>
    );
  }

  if (state === 'editing') {
    return (
      <div data-slot="comment-item-body" className={styles.body({ className })} {...props}>
        {children}
      </div>
    );
  }

  return (
    <>
      <div data-slot="comment-item-body" className={styles.body({ className })} {...props}>
        <p
          ref={open ? undefined : measure}
          className={open ? 'm-0' : styles.clamp({ className: 'm-0' })}
        >
          {children}
        </p>
      </div>
      {(clamped || open) && (
        <Button
          variant="ghost"
          tone="accent"
          size="sm"
          aria-expanded={open}
          className="col-start-2 justify-self-start px-0"
          onClick={() => setOpen(!open)}
        >
          {open ? tOr('appUi.showLess', {}, '') : tOr('appUi.readMore', {}, '')}
        </Button>
      )}
    </>
  );
}

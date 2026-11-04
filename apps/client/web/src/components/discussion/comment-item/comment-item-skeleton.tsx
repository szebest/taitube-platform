import { Skeleton } from '@vp/ui';

import { commentItemStyles } from './comment-item.variants';
import type { CommentLevel } from './types';

export function CommentItemSkeleton({ level = 'comment' }: { level?: CommentLevel }) {
  const styles = commentItemStyles();
  const circle =
    level === 'comment' ? 'size-avatar-lg max-medium:size-avatar-md' : 'size-avatar-sm';

  return (
    <div data-slot="comment-item-skeleton" aria-hidden="true" className={styles.root()}>
      <Skeleton shape="circle" className={styles.avatar({ className: circle })} />
      <Skeleton radius="xs" className="col-start-2 h-[1rem] w-[7.5rem]" />
      <Skeleton radius="xs" className="col-start-2 h-[1.4375rem] w-full" />
      <Skeleton radius="xs" className="col-start-2 h-[1.4375rem] w-[72%]" />
      <Skeleton radius="xs" className="col-start-2 h-[1.75rem] w-[8.75rem]" />
    </div>
  );
}

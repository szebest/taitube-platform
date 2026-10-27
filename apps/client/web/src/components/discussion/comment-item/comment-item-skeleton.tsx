import { Skeleton } from '@vp/ui';

import { commentItemStyles } from './comment-item.variants';
import type { CommentLevel } from './types';

export function CommentItemSkeleton({ level = 'comment' }: { level?: CommentLevel }) {
  const styles = commentItemStyles();
  const circle =
    level === 'comment' ? 'tw:size-avatar-lg tw:max-medium:size-avatar-md' : 'tw:size-avatar-sm';

  return (
    <div data-slot="comment-item-skeleton" aria-hidden="true" className={styles.root()}>
      <Skeleton shape="circle" className={styles.avatar({ className: circle })} />
      <Skeleton radius="xs" className="tw:col-start-2 tw:h-[1rem] tw:w-[7.5rem]" />
      <Skeleton radius="xs" className="tw:col-start-2 tw:h-[1.4375rem] tw:w-full" />
      <Skeleton radius="xs" className="tw:col-start-2 tw:h-[1.4375rem] tw:w-[72%]" />
      <Skeleton radius="xs" className="tw:col-start-2 tw:h-[1.75rem] tw:w-[8.75rem]" />
    </div>
  );
}

import { Skeleton } from '@vp/ui';
import { queueStyles } from '#app/components/watch/queue/queue.variants';
import type { QueueLayout } from '#app/components/watch/queue/types';

const SKELETON_ROWS = ['first', 'second', 'third', 'fourth', 'fifth'];

export function QueueSkeleton({ layout }: { layout?: QueueLayout }) {
  const styles = queueStyles({ layout: layout ?? 'auto' });

  return (
    <div data-slot="queue-skeleton" aria-hidden="true" className={styles.root()}>
      <Skeleton radius="xs" className="h-[1.75rem] w-[10rem]" />
      <div className="flex flex-col gap-1">
        {SKELETON_ROWS.map((row) => (
          <div key={row} className="flex h-[4.75rem] items-center gap-inline">
            <Skeleton radius="thumb" className="h-[4.21875rem] w-[7.5rem] shrink-0" />
            <div className="flex flex-1 flex-col gap-inline">
              <Skeleton radius="xs" className="h-[1rem] w-full" />
              <Skeleton radius="xs" className="h-[1rem] w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

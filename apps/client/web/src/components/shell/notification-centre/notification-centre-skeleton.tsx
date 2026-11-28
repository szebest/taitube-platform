import { Skeleton } from '@kit/ui';
import { notificationCentreStyles } from './notification-centre.variants';

const SKELETON_ROWS = ['first', 'second', 'third', 'fourth', 'fifth'];

export function NotificationCentreSkeleton() {
  const styles = notificationCentreStyles();

  return (
    <div
      data-slot="notification-centre-skeleton"
      aria-hidden="true"
      className="flex h-[30rem] w-[25rem] max-w-full flex-col overflow-hidden rounded-card bg-raised"
    >
      <div className={styles.header()}>
        <Skeleton shape="text" className="w-[8rem]" />
      </div>
      <NotificationCentreSkeletonRows />
    </div>
  );
}

/** The five placeholder rows, alone, for a body whose list is loading under a real header. */
export function NotificationCentreSkeletonRows() {
  return SKELETON_ROWS.map((row) => (
    <div
      key={row}
      aria-hidden="true"
      className="flex h-[4.5rem] items-center gap-stack ps-inset-card pe-inset-control"
    >
      <Skeleton shape="circle" className="size-control-md shrink-0" />
      <div className="flex flex-1 flex-col gap-inline">
        <Skeleton shape="text" className="w-full" />
        <Skeleton shape="text" className="w-[60%]" />
      </div>
    </div>
  ));
}

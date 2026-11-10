import { Skeleton } from '@vp/ui';
import { channelHeaderStyles } from './channel-header.variants';
import type { ChannelHeaderLayout } from './types';

export function ChannelHeaderSkeleton({ layout = 'full' }: { layout?: ChannelHeaderLayout }) {
  const styles = channelHeaderStyles({ layout });

  return (
    <div data-slot="channel-header-skeleton" aria-hidden="true" className={styles.root()}>
      {layout === 'full' && (
        <div className={styles.bannerFrame()}>
          <Skeleton
            radius="card"
            className="aspect-[3/1] w-full medium:aspect-[4/1] expanded:aspect-[6/1]"
          />
        </div>
      )}
      <div className={styles.identity()}>
        <Skeleton shape="circle" className={styles.avatar({ className: 'size-avatar-xl' })} />
        <Skeleton shape="text" className={styles.name({ className: 'w-[17.5rem] max-w-full' })} />
        <Skeleton shape="text" className={styles.stats({ className: 'w-[13.75rem]' })} />
        <Skeleton
          shape="text"
          className={styles.bio({ className: 'w-[22.5rem] max-w-full text-body' })}
        />
        <div className={styles.actions()}>
          <Skeleton radius="control" className="h-control-md w-[7.5rem] max-medium:flex-1" />
        </div>
      </div>
      {layout === 'full' && <Skeleton radius="xs" className="h-control-md w-full" />}
    </div>
  );
}

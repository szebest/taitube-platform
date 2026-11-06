import { Skeleton } from '@vp/ui';
import { VideoThumbnailSkeleton } from '../video-thumbnail';
import type { VideoCardSize, VideoCardVariant } from './types';
import { videoCardStyles } from './video-card.variants';

export interface VideoCardSkeletonProps {
  variant?: VideoCardVariant;
  size?: VideoCardSize;
  /** How many cards to hold the place of. */
  count?: number;
}

const bar = (className: string) => <Skeleton shape="text" radius="xs" className={className} />;

function OneCardSkeleton({ variant = 'grid', size = 'md' }: Omit<VideoCardSkeletonProps, 'count'>) {
  const styles = videoCardStyles({ variant, size });

  return (
    <div data-slot="video-card-skeleton" className={styles.root()}>
      <VideoThumbnailSkeleton
        aspect={variant === 'poster' ? 'poster' : 'video'}
        className={styles.thumb()}
      />
      {variant !== 'poster' && (
        <>
          {variant !== 'row' && (
            <div className={styles.byline()}>
              <Skeleton shape="circle" className="size-avatar-xs" />
              {bar('w-30 text-overline')}
            </div>
          )}
          {bar(styles.title({ className: 'w-full after:hidden' }))}
          {bar(styles.title({ className: 'w-2/3 after:hidden' }))}
          {bar(styles.meta({ className: 'w-35' }))}
          {variant === 'shelf' && bar(styles.reason({ className: 'w-40' }))}
        </>
      )}
    </div>
  );
}

/** Holds the place of `count` cards of a variant at their loaded size, so nothing shifts when they arrive. */
export function VideoCardSkeleton({ count = 1, ...props }: VideoCardSkeletonProps) {
  return Array.from({ length: count }, (_, index) => <OneCardSkeleton key={index} {...props} />);
}

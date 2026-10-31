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
              <Skeleton shape="circle" className="tw:size-avatar-xs" />
              {bar('tw:w-30 tw:text-overline')}
            </div>
          )}
          {bar(styles.title({ className: 'tw:w-full tw:after:hidden' }))}
          {bar(styles.title({ className: 'tw:w-2/3 tw:after:hidden' }))}
          {bar(styles.meta({ className: 'tw:w-35' }))}
          {variant === 'shelf' && bar(styles.reason({ className: 'tw:w-40' }))}
        </>
      )}
    </div>
  );
}

/** Holds the place of `count` cards of a variant at their loaded size, so nothing shifts when they arrive. */
export function VideoCardSkeleton({ count = 1, ...props }: VideoCardSkeletonProps) {
  return Array.from({ length: count }, (_, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders with no identity of their own.
    <OneCardSkeleton key={index} {...props} />
  ));
}

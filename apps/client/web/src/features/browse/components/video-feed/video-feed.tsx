import type {
  InfiniteData,
  QueryKey,
  UseSuspenseInfiniteQueryOptions,
} from '@tanstack/react-query';
import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { Button, Skeleton } from '@vp/ui';
import { useEffect, useEffectEvent, useRef } from 'react';

import { useVideoPages } from '#app/hooks/use-video-pages';
import { VideoGrid, VideoGridSkeleton } from '../video-grid/video-grid';

/** About two rows of cards below the fold, so the next page is in before the sentinel shows. */
const PREFETCH_MARGIN = '0px 0px 1200px 0px';

type VideoPage = { items: VideoSummary[]; nextCursor: string | null };

export interface VideoFeedProps<TPage extends VideoPage, TKey extends QueryKey> {
  title: string;
  options: UseSuspenseInfiniteQueryOptions<
    TPage,
    Error,
    InfiniteData<TPage>,
    TKey,
    string | undefined
  >;
}

export function VideoFeed<TPage extends VideoPage, TKey extends QueryKey>({
  title,
  options,
}: VideoFeedProps<TPage, TKey>) {
  const { tOr } = useT();

  const { videos, hasMore, isFetching, isError, loadMore } = useVideoPages(options);

  return (
    <section className="tw:flex tw:flex-col tw:gap-6">
      <h1 className="tw:m-0 tw:text-xl tw:font-bold">{title}</h1>
      {videos.length === 0 ? (
        <p className="tw:text-fg-muted">{tOr('browse.empty', {}, '')}</p>
      ) : (
        <VideoGrid videos={videos} />
      )}
      {isError && (
        <div role="alert" className="tw:flex tw:items-center tw:justify-center tw:gap-3">
          <span>{tOr('browse.loadMoreFailed', {}, '')}</span>
          <Button variant="secondary" size="sm" onClick={loadMore}>
            {tOr('browse.retry', {}, '')}
          </Button>
        </div>
      )}
      {hasMore && !isFetching && !isError && <FeedSentinel onNear={loadMore} />}
    </section>
  );
}

export function VideoFeedSkeleton() {
  return (
    <section aria-hidden="true" className="tw:flex tw:flex-col tw:gap-6">
      <Skeleton className="tw:h-7 tw:w-40" />
      <VideoGridSkeleton />
    </section>
  );
}

function FeedSentinel({ onNear }: { onNear: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  const near = useEffectEvent(() => onNear());

  useEffect(() => {
    const target = ref.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]: IntersectionObserverEntry[]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        near();
      },
      { rootMargin: PREFETCH_MARGIN }
    );
    observer.observe(target);

    const stopObserving = () => observer.disconnect();
    return stopObserving;
  }, []);

  return <div ref={ref} aria-hidden="true" />;
}

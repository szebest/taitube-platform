import type { QueryKey } from '@tanstack/react-query';
import { EmptyState, NoResultsIllustration, PageHeader, SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { Skeleton } from '@vp/ui';
import { useEffect, useEffectEvent, useRef } from 'react';

import { type VideoPage, type VideoPagesOptions, useVideoPages } from '#app/hooks/use-video-pages';
import { VideoGrid, VideoGridSkeleton } from '../video-grid/video-grid';

/** About two rows of cards below the fold, so the next page is in before the sentinel shows. */
const PREFETCH_MARGIN = '0px 0px 1200px 0px';

export interface VideoFeedProps<TPage extends VideoPage, TKey extends QueryKey> {
  title: string;
  options: VideoPagesOptions<TPage, TKey>;
}

export function VideoFeed<TPage extends VideoPage, TKey extends QueryKey>({
  title,
  options,
}: VideoFeedProps<TPage, TKey>) {
  const { tOr } = useT();

  const { videos, hasMore, isFetching, isError, loadMore } = useVideoPages(options);

  return (
    <section className="tw:flex tw:flex-col tw:gap-6">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{title}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      {videos.length === 0 ? (
        <EmptyState.Root size="section">
          <EmptyState.Illustration>
            <NoResultsIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>{tOr('browse.empty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      ) : (
        <VideoGrid videos={videos} />
      )}
      {isError && (
        <SectionError.Root role="alert" retrying={isFetching} onRetry={loadMore}>
          <SectionError.Message>{tOr('browse.loadMoreFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
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

import { SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { myVideosQueryOptions, useApi } from '@vp/queries';

import { FeedSentinel } from '#app/features/browse/components/feed-sentinel/feed-sentinel';
import { VideoGrid } from '#app/features/browse/components/video-grid/video-grid';
import { useVideoPages } from '#app/hooks/use-video-pages';

/** The viewer's own uploads on their channel page, paging in as they scroll. */
export function OwnVideos() {
  const api = useApi();
  const { tOr } = useT();
  const { videos, hasMore, isFetching, isError, loadMore } = useVideoPages(
    myVideosQueryOptions(api)
  );

  if (videos.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="m-0 text-title">{tOr('channels.yourVideos', {}, '')}</h2>
      <VideoGrid videos={videos} />
      {isError && (
        <SectionError.Root role="alert" retrying={isFetching} onRetry={loadMore}>
          <SectionError.Message>{tOr('browse.loadMoreFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {hasMore && !isFetching && !isError && <FeedSentinel onNear={loadMore} />}
    </section>
  );
}

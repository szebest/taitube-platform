import { SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';

import { FeedSentinel } from '#app/features/browse/components/feed-sentinel/feed-sentinel';

export interface PagedFooterProps {
  hasMore: boolean;
  isFetching: boolean;
  isError: boolean;
  onLoadMore: () => void;
}

/** Under a keyset list: the next page loads as the viewer nears the end, and a failed one offers a retry. */
export function PagedFooter({ hasMore, isFetching, isError, onLoadMore }: PagedFooterProps) {
  const { tOr } = useT();

  return (
    <>
      {isError && (
        <SectionError.Root role="alert" retrying={isFetching} onRetry={onLoadMore}>
          <SectionError.Message>{tOr('browse.loadMoreFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {hasMore && !isFetching && !isError && <FeedSentinel onNear={onLoadMore} />}
    </>
  );
}

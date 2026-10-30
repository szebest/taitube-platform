import { useT } from '@vp/intl-react';
import { Button } from '@vp/ui';

export interface LoadMoreProps {
  hasNextPage: boolean;
  fetching: boolean;
  onLoadMore: () => void;
}

/** The way to the next keyset page of a table; absent on the last one. */
export function LoadMore({ hasNextPage, fetching, onLoadMore }: LoadMoreProps) {
  const { tOr } = useT();

  if (!hasNextPage) {
    return null;
  }

  return (
    <div className="tw:flex tw:justify-center">
      <Button variant="outline" size="sm" loading={fetching} onClick={onLoadMore}>
        {tOr('studio.adminLoadMore', {}, '')}
      </Button>
    </div>
  );
}

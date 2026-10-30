import type { HomeShelf as HomeShelfData } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { assertNever } from '@vp/result';

import { Shelf } from '#app/components/discovery/shelf';
import { FeedVideoCard } from '#app/features/browse/components/feed-video-card';

type Translate = ReturnType<typeof useT>['tOr'];

function shelfTitle({ kind, subject }: HomeShelfData, tOr: Translate): string {
  const name = subject?.name ?? '';
  switch (kind) {
    case 'continue':
      return tOr('home.continueWatching', {}, '');
    case 'subscriptions':
      return tOr('home.fromSubscriptions', {}, '');
    case 'because-watched':
      return tOr('home.becauseWatched', { name }, '');
    case 'category':
      return tOr('home.popularIn', { name }, '');
    case 'trending':
      return tOr('home.trending', {}, '');
    default:
      return assertNever(kind, 'shelfTitle');
  }
}

export interface HomeShelfProps {
  shelf: HomeShelfData;
}

export function HomeShelf({ shelf }: HomeShelfProps) {
  const { tOr } = useT();

  return (
    <Shelf.Root>
      <Shelf.Header>
        <Shelf.Title>{shelfTitle(shelf, tOr)}</Shelf.Title>
      </Shelf.Header>
      <Shelf.Track>
        {shelf.items.map((item) => (
          <Shelf.Item key={item.id}>
            <FeedVideoCard video={item} reason={item.reason} />
          </Shelf.Item>
        ))}
      </Shelf.Track>
    </Shelf.Root>
  );
}

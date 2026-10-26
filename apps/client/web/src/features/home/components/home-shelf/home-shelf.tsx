import type { HomeShelf as HomeShelfData } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { assertNever } from '@vp/result';

import { VideoCard } from '#app/features/browse/components/video-card/video-card';

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
    <section className="tw:flex tw:flex-col tw:gap-4">
      <h2 className="tw:m-0 tw:text-lg tw:font-bold">{shelfTitle(shelf, tOr)}</h2>
      <ul className="tw:m-0 tw:flex tw:list-none tw:gap-4 tw:overflow-x-auto tw:p-0 tw:pb-2">
        {shelf.items.map((item) => (
          <li key={item.id} className="tw:w-64 tw:shrink-0">
            <VideoCard video={item} reason={item.reason} />
          </li>
        ))}
      </ul>
    </section>
  );
}

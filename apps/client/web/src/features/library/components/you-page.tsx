import { PageHeader } from '@vp/components';
import { useT } from '@vp/intl-react';

import { ShelfSkeleton } from '#app/components/discovery/shelf';

import { HistoryShelf } from './history-shelf';
import { PlaylistsShelf } from './playlists-shelf';
import { UploadsShelf } from './uploads-shelf';
import { WatchLaterShelf } from './watch-later-shelf';

/** `/feed/you`: a shelf each for History, Watch later, Playlists and the viewer's own videos. */
export function YouPage() {
  const { tOr } = useT();

  return (
    <div className="tw:flex tw:flex-col tw:gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('library.youTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <HistoryShelf />
      <WatchLaterShelf />
      <PlaylistsShelf />
      <UploadsShelf />
    </div>
  );
}

export function YouPageSkeleton() {
  return (
    <div aria-hidden="true" className="tw:flex tw:flex-col tw:gap-section">
      <ShelfSkeleton />
      <ShelfSkeleton />
    </div>
  );
}

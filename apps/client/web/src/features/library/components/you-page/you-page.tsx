import { PageHeader, ShelfSkeleton } from '@vp/components';
import { useT } from '@vp/intl-react';
import { ClipsShelf } from '#app/features/clips/components/clips-shelf';
import { HistoryShelf } from './history-shelf';
import { PlaylistsShelf } from './playlists-shelf';
import { UploadsShelf } from './uploads-shelf';
import { WatchLaterShelf } from './watch-later-shelf';

/** `/feed/you`: a shelf each for History, Watch later, Playlists, the viewer's own videos and their clips. */
export function YouPage() {
  const { tOr } = useT();

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('library.youTitle', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <HistoryShelf />
      <WatchLaterShelf />
      <PlaylistsShelf />
      <UploadsShelf />
      <ClipsShelf />
    </div>
  );
}

export function YouPageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-section">
      <ShelfSkeleton />
      <ShelfSkeleton />
    </div>
  );
}

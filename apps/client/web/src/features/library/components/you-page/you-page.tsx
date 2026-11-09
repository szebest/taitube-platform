import { PageHeader, ShelfSkeleton } from '@vp/components';
import { useT } from '@vp/intl-react';
import type { ReactNode } from 'react';
import { HistoryShelf } from '../history-shelf/history-shelf';
import { PlaylistsShelf } from '../playlists-shelf/playlists-shelf';
import { UploadsShelf } from '../uploads-shelf/uploads-shelf';
import { WatchLaterShelf } from '../watch-later-shelf/watch-later-shelf';

/** `/feed/you`: a shelf each for History, Watch later, Playlists, the viewer's own videos and their clips. */
export interface YouPageProps {
  /** The viewer's clips shelf, which a route composes in. */
  clips: ReactNode;
}

export function YouPage({ clips }: YouPageProps) {
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
      {clips}
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

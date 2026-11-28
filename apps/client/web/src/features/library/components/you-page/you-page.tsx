import { PageHeader, ShelfSkeleton } from '@kit/components';
import type { ReactNode } from 'react';
import { useT } from '#app/lib/messages';
import { FollowingShelf } from '../following-shelf/following-shelf';
import { HistoryShelf } from '../history-shelf/history-shelf';
import { PinnedShelves } from '../pinned-shelves/pinned-shelves';
import { PlaylistsShelf } from '../playlists-shelf/playlists-shelf';
import { UploadsShelf } from '../uploads-shelf/uploads-shelf';
import { WatchLaterShelf } from '../watch-later-shelf/watch-later-shelf';

export interface YouPageProps {
  /** The viewer's clips shelf, which a route composes in. */
  clips: ReactNode;
}

/**
 * `/feed/you`: a shelf each for History, Watch later, every pinned playlist, Playlists, the ones the
 * viewer follows, their own videos and their clips.
 */
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
      <PinnedShelves />
      <PlaylistsShelf />
      <FollowingShelf />
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

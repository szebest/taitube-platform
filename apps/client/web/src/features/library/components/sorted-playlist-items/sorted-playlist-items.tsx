import { SectionError } from '@kit/components';
import { Callout } from '@kit/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { PlaylistItemSort } from '@vp/domain';
import { useApi } from '@vp/queries';
import { PagedFooter } from '#app/components/feed/paged-footer';
import {
  PlaylistItemRow,
  PlaylistItemRowSkeleton,
} from '#app/components/playlist/playlist-item-row';
import { sortedPlaylistItemsQueryOptions } from '#app/features/library/api/playlist-queries';
import { useSegmentText } from '#app/features/library/hooks/use-segment-text';
import { useT } from '#app/lib/messages';
import { LibraryVideoRow } from '../library-video-row/library-video-row';

const SKELETON_ROWS = 3;

export interface SortedPlaylistItemsProps {
  playlistId: string;
  title: string;
  sort: Exclude<PlaylistItemSort, 'manual'>;
  /** A share link's token the page was opened with. */
  shareToken: string | undefined;
}

/** The playlist's videos in a viewing order, read-only: nothing drags and no item has a menu. */
export function SortedPlaylistItems({
  playlistId,
  title,
  sort,
  shareToken,
}: SortedPlaylistItemsProps) {
  const api = useApi();
  const { tOr } = useT();
  const { segment } = useSegmentText();
  const { data, isPending, isError, isFetching, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery(sortedPlaylistItemsQueryOptions(api, playlistId, sort, shareToken));

  if (isPending) {
    return (
      <div aria-hidden="true" className="flex flex-col gap-stack">
        {Array.from({ length: SKELETON_ROWS }, (_, row) => (
          <PlaylistItemRowSkeleton key={row} />
        ))}
      </div>
    );
  }
  if (isError && data === undefined) {
    return (
      <SectionError.Root role="alert" retrying={isFetching} onRetry={() => void refetch()}>
        <SectionError.Message>{tOr('playlistEdit.sortedLoadFailed', {}, '')}</SectionError.Message>
      </SectionError.Root>
    );
  }

  const items = data.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-stack">
      <Callout.Root tone="info">
        <Callout.Body>{tOr('playlistEdit.sortedReadOnly', {}, '')}</Callout.Body>
      </Callout.Root>
      <ul
        aria-label={tOr('library.playlistItems', { title }, '')}
        className="m-0 flex list-none flex-col gap-stack p-0"
      >
        {items.map(({ id, video, addedAt, note, startMs, endMs }) => {
          const segmentText = segment(startMs, endMs);
          return (
            <li key={id} className="flex">
              <PlaylistItemRow.Root>
                <PlaylistItemRow.Body>
                  <LibraryVideoRow video={video} at={addedAt} actions={null} />
                </PlaylistItemRow.Body>
                {note !== null && <PlaylistItemRow.Note>{note}</PlaylistItemRow.Note>}
                {segmentText !== null && (
                  <PlaylistItemRow.Segment>{segmentText}</PlaylistItemRow.Segment>
                )}
              </PlaylistItemRow.Root>
            </li>
          );
        })}
      </ul>
      <PagedFooter
        hasMore={hasNextPage}
        isFetching={isFetching}
        isError={isError}
        onLoadMore={() => void fetchNextPage({ cancelRefetch: false })}
      />
    </div>
  );
}

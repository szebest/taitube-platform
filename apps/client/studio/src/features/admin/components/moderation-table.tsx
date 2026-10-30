import { useInfiniteQuery } from '@tanstack/react-query';
import { createColumnHelper, type OnChangeFn, type SortingState, useTable } from '@tanstack/react-table';
import { getRouteApi } from '@tanstack/react-router';
import { EmptyState, SectionError } from '@vp/components';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { canDeleteVideo, canModerateVideo, canUpdateVideo } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { DropdownMenu, Icon, IconButton } from '@vp/ui';
import { useState } from 'react';

import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { type AdminVideo, adminVideosQueryOptions } from '#app/features/admin/api/admin-videos';
import { sortingOf, sortOf } from '#app/features/admin/api/moderation-search';
import { pagedRows, tableStateOf } from '#app/features/admin/api/paged-rows';
import { LoadMore } from './load-more';
import { ModerationFilters } from './moderation-filters';
import { VideoOverrideDialog, type VideoOverride } from './video-override-dialog';

const route = getRouteApi('/_authed/admin/moderation');
const column = createColumnHelper<DataTableFeatures, AdminVideo>();

interface RowMenuProps {
  video: AdminVideo;
  onOverride: (action: VideoOverride) => void;
}

function RowMenu({ video, onOverride }: RowMenuProps) {
  const { tOr } = useT();
  const canPrivate = useCan(canUpdateVideo, { video }) && video.visibility !== 'private';
  const canReject = useCan(canModerateVideo, { video }) && video.status !== 'REJECTED';
  const canDelete = useCan(canDeleteVideo, { video });

  if (!(canPrivate || canReject || canDelete)) {
    return null;
  }

  const title = video.title ?? tOr('browse.untitled', {}, '');

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton size="sm" aria-label={tOr('studio.videoActions', { title }, '')}>
          <Icon name="more" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        {canPrivate && (
          <DropdownMenu.Item onSelect={() => onOverride('force-private')}>
            {tOr('studio.adminVideoForcePrivate', {}, '')}
          </DropdownMenu.Item>
        )}
        {canReject && (
          <DropdownMenu.Item tone="danger" onSelect={() => onOverride('reject')}>
            {tOr('studio.adminVideoReject', {}, '')}
          </DropdownMenu.Item>
        )}
        {canDelete && (
          <DropdownMenu.Item tone="danger" onSelect={() => onOverride('delete')}>
            {tOr('studio.adminVideoDelete', {}, '')}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

/** Every owner's videos on the studio's `DataTable`, filtered and sorted by the URL, with the overrides an admin may apply. */
export function ModerationTable() {
  const { tOr } = useT();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const videos = useInfiniteQuery({
    ...adminVideosQueryOptions(useApi(), search),
    select: pagedRows,
  });
  const [override, setOverride] = useState<{ action: VideoOverride; video: AdminVideo }>();

  const rows = videos.data ?? [];
  const sorting = sortingOf(search);
  const state = tableStateOf(videos, rows.length);
  const filtered = Boolean(search.q || search.status || search.visibility || search.categoryId);

  const changeSorting: OnChangeFn<SortingState> = (updater) =>
    navigate({
      search: (previous) => ({
        ...previous,
        ...sortOf(typeof updater === 'function' ? updater(sorting) : updater),
      }),
    });

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.accessor('title', {
        header: tOr('studio.adminVideoTitle', {}, ''),
        cell: ({ row }) => row.original.title ?? tOr('browse.untitled', {}, ''),
      }),
      column.accessor((video) => video.channel?.displayName ?? '', {
        id: 'channel',
        header: tOr('studio.adminVideoChannel', {}, ''),
        enableSorting: false,
      }),
      column.accessor('status', {
        header: tOr('studio.adminVideoStatus', {}, ''),
        enableSorting: false,
        cell: ({ row }) => tOr('studio.videoStatus', { status: row.original.status }, ''),
      }),
      column.accessor('visibility', {
        header: tOr('studio.adminVideoVisibility', {}, ''),
        enableSorting: false,
        cell: ({ row }) => tOr('videos.visibility', { visibility: row.original.visibility }, ''),
      }),
      column.accessor('viewsCount', {
        id: 'viewsCount',
        header: tOr('studio.adminVideoViews', {}, ''),
        meta: { numeric: true, width: '6rem' },
        cell: ({ row }) => <Format value={{ type: 'count', value: row.original.viewsCount ?? 0 }} />,
      }),
      column.accessor('likesCount', {
        id: 'likesCount',
        header: tOr('studio.adminVideoLikes', {}, ''),
        meta: { numeric: true, width: '6rem' },
        cell: ({ row }) => <Format value={{ type: 'count', value: row.original.likesCount ?? 0 }} />,
      }),
      column.accessor('createdAt', {
        header: tOr('studio.adminVideoUploaded', {}, ''),
        cell: ({ row }) => (
          <time dateTime={row.original.createdAt}>
            <Format value={publishedAt(row.original.createdAt).relative} />
          </time>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.adminVideoActions', {}, ''),
        meta: { width: '6rem' },
        cell: ({ row }) => (
          <RowMenu
            video={row.original}
            onOverride={(action) => setOverride({ action, video: row.original })}
          />
        ),
      }),
    ]),
    data: rows,
    getRowId: ({ id }) => id,
    enableRowSelection: false,
    manualPagination: true,
    manualSorting: true,
    enableMultiSort: false,
    state: { sorting },
    onSortingChange: changeSorting,
  });

  return (
    <>
      <DataTable.Root
        table={table}
        state={state}
        fetching={videos.isFetching && !videos.isPending}
      >
        <DataTable.Caption>{tOr('studio.adminVideosCaption', {}, '')}</DataTable.Caption>
        <DataTable.Toolbar>
          <ModerationFilters />
        </DataTable.Toolbar>
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.adminVideosEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.adminVideosEmptyDescription', {}, '')}
              </EmptyState.Description>
              {filtered && (
                <EmptyState.Action
                  onClick={() => navigate({ search: {} })}
                >
                  {tOr('studio.adminFiltersClear', {}, '')}
                </EmptyState.Action>
              )}
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root onRetry={() => videos.refetch()} retrying={videos.isFetching}>
              <SectionError.Message>{tOr('studio.adminVideosFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      <LoadMore
        hasNextPage={videos.hasNextPage}
        fetching={videos.isFetchingNextPage}
        onLoadMore={() => videos.fetchNextPage()}
      />
      {override && <VideoOverrideDialog {...override} onClose={() => setOverride(undefined)} />}
    </>
  );
}

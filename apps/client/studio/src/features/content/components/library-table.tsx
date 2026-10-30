import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  functionalUpdate,
  type OnChangeFn,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { KEYSET_PAGE_SIZE, useApi } from '@vp/queries';
import { Input } from '@vp/ui';
import { useState } from 'react';

import { DataTable, dataTableFeatures } from '#app/components/table/data-table';
import type { BatchOutcome } from '../api/batch-actions';
import { libraryQueryOptions } from '../api/library-queries';
import { LibraryBatchActions } from './library-batch-actions';
import { createLibraryColumns, SORT_COLUMNS, sortOfColumn } from './library-columns';

const LIBRARY_ID = '/_authed/videos/';
const LIBRARY_PATH = '/videos/';
const PAGE_SIZES = [KEYSET_PAGE_SIZE];

interface LibraryTableProps {
  onInspect: (videoId: string) => void;
}

export function LibraryTable({ onInspect }: LibraryTableProps) {
  const api = useApi();
  const navigate = useNavigate({ from: LIBRARY_PATH });
  const search = useSearch({ from: LIBRARY_ID });
  const { tOr } = useT();
  const { data: view, isFetching } = useSuspenseQuery(
    libraryQueryOptions(api, search.sort, search.page)
  );

  const viewKey = `${search.sort}|${search.page}|${search.q ?? ''}`;
  const [selected, setSelected] = useState<{ viewKey: string; rows: RowSelectionState }>({
    viewKey,
    rows: {},
  });
  const rowSelection = selected.viewKey === viewKey ? selected.rows : {};

  const filter = search.q?.trim().toLowerCase() ?? '';
  const rows = view.items.filter((video) => (video.title ?? '').toLowerCase().includes(filter));
  const sorting: SortingState = [{ id: SORT_COLUMNS[search.sort], desc: true }];
  const pagination: PaginationState = { pageIndex: view.page - 1, pageSize: KEYSET_PAGE_SIZE };
  const first = (view.page - 1) * KEYSET_PAGE_SIZE + 1;

  const changeSorting: OnChangeFn<SortingState> = (updater) => {
    const sort = sortOfColumn(functionalUpdate(updater, sorting)[0]?.id);
    if (sort !== undefined) {
      void navigate({ search: (previous) => ({ ...previous, sort, page: 1 }) });
    }
  };

  const changePagination: OnChangeFn<PaginationState> = (updater) => {
    const { pageIndex } = functionalUpdate(updater, pagination);
    void navigate({ search: (previous) => ({ ...previous, page: pageIndex + 1 }) });
  };

  const selectedVideos = view.items.filter((video) => rowSelection[video.id]);

  const keepFailedSelected = ({ failed }: BatchOutcome) => {
    setSelected({ viewKey, rows: Object.fromEntries(failed.map((id) => [id, true])) });
  };

  const changeSelection: OnChangeFn<RowSelectionState> = (updater) => {
    setSelected({ viewKey, rows: functionalUpdate(updater, rowSelection) });
  };

  const table = useTable({
    features: dataTableFeatures,
    columns: createLibraryColumns(onInspect),
    data: rows,
    getRowId: (video) => video.id,
    manualSorting: true,
    manualPagination: true,
    pageCount: view.page + (view.hasNextPage ? 1 : 0),
    state: { sorting, pagination, rowSelection },
    onSortingChange: changeSorting,
    onPaginationChange: changePagination,
    onRowSelectionChange: changeSelection,
  });

  if (view.items.length === 0) {
    return (
      <EmptyState.Root>
        <EmptyState.Illustration>
          <EmptyLibraryIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title>{tOr('studio.libraryEmpty', {}, '')}</EmptyState.Title>
        <EmptyState.Action asChild>
          <Link to="/upload">{tOr('studio.navUpload', {}, '')}</Link>
        </EmptyState.Action>
      </EmptyState.Root>
    );
  }

  return (
    <DataTable.Root
      table={table}
      state={rows.length === 0 ? 'empty' : 'ready'}
      fetching={isFetching}
    >
      <DataTable.Caption>{tOr('studio.libraryTitle', {}, '')}</DataTable.Caption>
      <DataTable.Toolbar>
        <Input
          type="search"
          aria-label={tOr('studio.libraryFilter', {}, '')}
          placeholder={tOr('studio.libraryFilter', {}, '')}
          value={search.q ?? ''}
          onChange={(event) =>
            void navigate({
              search: (previous) => ({ ...previous, q: event.target.value || undefined }),
              replace: true,
            })
          }
        />
      </DataTable.Toolbar>
      <DataTable.Batch>
        <LibraryBatchActions videos={selectedVideos} onSettled={keepFailedSelected} />
      </DataTable.Batch>
      <DataTable.Header />
      <DataTable.Body onRowActivate={onInspect}>
        {tOr('studio.libraryNoMatch', {}, '')}
      </DataTable.Body>
      <DataTable.Pagination pageSizes={PAGE_SIZES}>
        <DataTable.Range>
          {tOr('studio.libraryRange', { from: first, to: first + view.items.length - 1 }, '')}
        </DataTable.Range>
      </DataTable.Pagination>
    </DataTable.Root>
  );
}

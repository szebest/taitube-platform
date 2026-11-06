import { createColumnHelper, type SortingState, useTable } from '@tanstack/react-table';
import { render, screen, within } from '@testing-library/react';
import { Button, Input } from '@vp/ui';
import type { ReactNode } from 'react';
import { AppProviders } from '#app/__tests__/providers';
import { DataTable, type DataTableFeatures, dataTableFeatures } from '..';
import type { DataTableState } from '../types';

interface FixtureVideo {
  id: string;
  title: string;
  status: string;
  views: number;
}

const VIDEOS: readonly FixtureVideo[] = [
  {
    id: 'lisbon',
    title: 'Shot entirely on a 1998 camcorder: Lisbon at night',
    status: 'Ready',
    views: 412008,
  },
  { id: 'porto', title: 'Night bus to Porto', status: 'Processing', views: 0 },
  { id: 'harbour', title: 'Harbour at dawn', status: 'Ready', views: 880 },
  { id: 'tram', title: 'Tram 28, end to end', status: 'Failed', views: 12430 },
  { id: 'making-of', title: 'Marta Reis Films: the making of', status: 'Ready', views: 96 },
];

const column = createColumnHelper<DataTableFeatures, FixtureVideo>();

export const VIDEO_COLUMNS = column.columns([
  column.accessor('title', { header: 'Title', meta: { width: '55%' } }),
  column.accessor('status', { header: 'Status', enableSorting: false, meta: { width: '20%' } }),
  column.accessor('views', { header: 'Views', meta: { numeric: true, width: '25%' } }),
]);

export interface VideoTableProps {
  data?: readonly FixtureVideo[];
  state?: DataTableState;
  fetching?: boolean;
  sorting?: SortingState;
  selected?: readonly string[];
  pageSize?: number;
  selectable?: boolean;
  onRowActivate?: (rowId: string) => void;
  message?: ReactNode;
}

/** The library as a feature would wire it, with client sorting and paging so the specs see both. */
function VideoTable({
  data = VIDEOS,
  state,
  fetching,
  sorting = [],
  selected = [],
  pageSize = 20,
  selectable = true,
  onRowActivate,
  message,
}: VideoTableProps) {
  const table = useTable({
    features: dataTableFeatures,
    columns: VIDEO_COLUMNS,
    data,
    getRowId: (video) => video.id,
    enableRowSelection: selectable,
    initialState: {
      sorting,
      rowSelection: Object.fromEntries(selected.map((id) => [id, true] as const)),
      pagination: { pageIndex: 0, pageSize },
    },
  });

  return (
    <DataTable.Root table={table} state={state} fetching={fetching}>
      <DataTable.Caption>Your videos</DataTable.Caption>
      <DataTable.Toolbar>
        <Input aria-label="Filter by title" placeholder="Filter by title" />
      </DataTable.Toolbar>
      <DataTable.Batch>
        <Button variant="outline" size="sm">
          Set visibility
        </Button>
        <Button tone="danger" size="sm">
          Delete
        </Button>
      </DataTable.Batch>
      <DataTable.Header />
      <DataTable.Body onRowActivate={onRowActivate}>{message}</DataTable.Body>
      <DataTable.Pagination>
        <DataTable.Range>
          1 to {data.length} of {data.length}
        </DataTable.Range>
      </DataTable.Pagination>
    </DataTable.Root>
  );
}

export const renderVideoTable = (props: VideoTableProps = {}) =>
  render(
    <AppProviders>
      <VideoTable {...props} />
    </AppProviders>
  );

/** The body's rows, past the header row. */
export const bodyRows = () =>
  within(screen.getAllByRole('rowgroup')[1] as HTMLElement).getAllByRole('row');

/** Each body row's title, in the order shown. */
export const shownTitles = () =>
  bodyRows().map((row) => within(row).getAllByRole('cell')[1]?.textContent);

import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createColumnHelper,
  type RowSelectionState,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { EmptyState, SectionError } from '@vp/components';
import { Badge, type BadgeTone, Button, Icon, type IconId, Input } from '@vp/ui';
import { DataTable, type DataTableFeatures, DataTableSkeleton, dataTableFeatures } from '.';
import type { DataTableState } from './types';

const THUMB =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='%23565046'/%3E%3C/svg%3E";

const STATUS: Readonly<Record<string, { tone: BadgeTone; icon: IconId }>> = {
  Ready: { tone: 'success', icon: 'check' },
  Processing: { tone: 'info', icon: 'clock' },
  Uploading: { tone: 'neutral', icon: 'upload' },
  Failed: { tone: 'danger', icon: 'alert' },
  Rejected: { tone: 'warning', icon: 'shield' },
};

interface StoryVideo {
  id: string;
  title: string;
  status: string;
  visibility: string;
  date: string;
  views: number;
  viewsLabel: string;
}

const VIDEOS: StoryVideo[] = [
  {
    id: 'lisbon',
    title: 'Shot entirely on a 1998 camcorder: Lisbon at night',
    status: 'Ready',
    visibility: 'Public',
    date: '2 d',
    views: 412008,
    viewsLabel: '412,008',
  },
  {
    id: 'porto',
    title: 'Night bus to Porto',
    status: 'Processing',
    visibility: 'Private',
    date: '1 h',
    views: 0,
    viewsLabel: '0',
  },
  {
    id: 'harbour',
    title: 'Harbour at dawn',
    status: 'Uploading',
    visibility: 'Unlisted',
    date: '3 h',
    views: 0,
    viewsLabel: '0',
  },
  {
    id: 'tram',
    title: 'Tram 28, end to end',
    status: 'Failed',
    visibility: 'Private',
    date: '5 d',
    views: 12430,
    viewsLabel: '12,430',
  },
  {
    id: 'making-of',
    title: 'Marta Reis Films: the making of',
    status: 'Rejected',
    visibility: 'Public',
    date: '2 w',
    views: 96,
    viewsLabel: '96',
  },
  {
    id: 'alfama',
    title: 'Alfama stairs, one take',
    status: 'Ready',
    visibility: 'Public',
    date: '3 w',
    views: 880,
    viewsLabel: '880',
  },
];

const column = createColumnHelper<DataTableFeatures, StoryVideo>();

const COLUMNS = column.columns([
  column.accessor('title', {
    header: 'Title',
    meta: { width: '22rem' },
    cell: ({ row }) => (
      <span className="tw:flex tw:items-center tw:gap-stack">
        <img src={THUMB} alt="" className="tw:w-row-thumb tw:shrink-0 tw:rounded-thumb" />
        <span className="tw:line-clamp-1">{row.original.title}</span>
      </span>
    ),
  }),
  column.accessor('status', {
    header: 'Status',
    enableSorting: false,
    meta: { width: '9rem' },
    cell: ({ getValue }) => {
      const { tone, icon } = STATUS[getValue()] ?? { tone: 'neutral', icon: 'info' };
      return (
        <Badge tone={tone} size="sm">
          <Icon name={icon} size="sm" />
          {getValue()}
        </Badge>
      );
    },
  }),
  column.accessor('visibility', { header: 'Visibility', enableSorting: false }),
  column.accessor('date', { header: 'Date', enableSorting: false }),
  column.accessor('views', {
    header: 'Views',
    meta: { numeric: true, width: '7rem' },
    cell: ({ row }) => row.original.viewsLabel,
  }),
]);

interface LibraryProps {
  state?: DataTableState;
  fetching?: boolean;
  sorting?: SortingState;
  rowSelection?: RowSelectionState;
}

function Library({ state, fetching, sorting = [], rowSelection = {} }: LibraryProps) {
  const table = useTable({
    features: dataTableFeatures,
    columns: COLUMNS,
    data: VIDEOS,
    getRowId: (video) => video.id,
    initialState: { sorting, rowSelection, pagination: { pageIndex: 0, pageSize: 20 } },
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
      <DataTable.Body>
        {state === 'empty' && (
          <EmptyState.Root>
            <EmptyState.Title>No videos yet</EmptyState.Title>
            <EmptyState.Description>Upload one and it shows up here.</EmptyState.Description>
          </EmptyState.Root>
        )}
        {state === 'error' && (
          <SectionError.Root onRetry={() => undefined}>
            <SectionError.Message>Could not load your videos.</SectionError.Message>
          </SectionError.Root>
        )}
      </DataTable.Body>
      <DataTable.Pagination>
        <DataTable.Range>1 to 6 of 6</DataTable.Range>
      </DataTable.Pagination>
    </DataTable.Root>
  );
}

const meta = {
  title: 'Studio/DataTable',
  globals: { spacing: 'compact', sizing: 'small' },
  render: () => <Library />,
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const VideoLibrary: Story = {};

export const SortedByViews: Story = {
  render: () => <Library sorting={[{ id: 'views', desc: true }]} />,
};

export const RowsSelected: Story = {
  render: () => <Library rowSelection={{ lisbon: true, porto: true, tram: true }} />,
};

export const StatusBadges: Story = {
  render: () => <Library sorting={[{ id: 'title', desc: false }]} />,
};

export const Loading: Story = {
  render: () => <Library state="loading" />,
};

export const Empty: Story = {
  render: () => <Library state="empty" />,
};

export const ErrorState: Story = {
  name: 'Error',
  render: () => <Library state="error" />,
};

export const Fetching: Story = {
  render: () => <Library fetching />,
};

export const HorizontalScroll: Story = {
  globals: { viewport: { value: 'mobile1' } },
};

export const RightToLeft: Story = {
  globals: { direction: 'rtl' },
};

export const Skeleton: Story = {
  render: () => <DataTableSkeleton columns={COLUMNS} />,
};

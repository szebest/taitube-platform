import { useInfiniteQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { EmptyState, SectionError } from '@vp/components';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { canAccessAdmin } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { Button } from '@vp/ui';
import { useState } from 'react';

import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import {
  adminDlqQueryOptions,
  DLQ_STATUS_OPTIONS,
  type DlqEntry,
  knownDlqStatus,
} from '#app/features/admin/api/admin-dlq';
import { pagedRows, tableStateOf } from '#app/features/admin/api/paged-rows';
import { type DlqAction, DlqActionDialog } from './dlq-action-dialog';
import { FilterSelect } from './filter-select';
import { LoadMore } from './load-more';

const route = getRouteApi('/_authed/admin/queues');
const column = createColumnHelper<DataTableFeatures, DlqEntry>();

const PARKED = 'PARKED';

const isoOf = (instant: string | Date) =>
  typeof instant === 'string' ? instant : instant.toISOString();

/** The dead-letter entries on the studio's `DataTable`, filtered by status from the URL, with replay and discard for the parked ones. */
export function DlqTable() {
  const { tOr } = useT();
  const { status } = route.useSearch();
  const navigate = route.useNavigate();
  const canManage = useCan(canAccessAdmin);
  const entries = useInfiniteQuery({
    ...adminDlqQueryOptions(useApi(), status),
    select: pagedRows,
  });
  const [open, setOpen] = useState<{ action: DlqAction; entry: DlqEntry }>();

  const rows = entries.data ?? [];
  const state = tableStateOf(entries, rows.length);

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.accessor('queue', {
        header: tOr('studio.adminDlqQueue', {}, ''),
        enableSorting: false,
      }),
      column.accessor('jobId', {
        header: tOr('studio.adminDlqJob', {}, ''),
        enableSorting: false,
      }),
      column.accessor((entry) => entry.errorCode ?? '', {
        id: 'error',
        header: tOr('studio.adminDlqError', {}, ''),
        enableSorting: false,
        cell: ({ row }) => (
          <span title={row.original.errorMessage ?? undefined}>{row.original.errorCode}</span>
        ),
      }),
      column.accessor('attemptsMade', {
        header: tOr('studio.adminDlqAttempts', {}, ''),
        enableSorting: false,
        meta: { numeric: true, width: '7rem' },
      }),
      column.accessor('status', {
        header: tOr('studio.adminDlqStatus', {}, ''),
        enableSorting: false,
        cell: ({ row }) => {
          const known = knownDlqStatus(row.original);
          return known ? tOr('studio.adminDlqStatusName', { status: known }, '') : row.original.status;
        },
      }),
      column.accessor((entry) => isoOf(entry.createdAt), {
        id: 'createdAt',
        header: tOr('studio.adminDlqFailedAt', {}, ''),
        enableSorting: false,
        cell: ({ row }) => (
          <time dateTime={isoOf(row.original.createdAt)}>
            <Format value={publishedAt(isoOf(row.original.createdAt)).relative} />
          </time>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.adminDlqActions', {}, ''),
        meta: { width: '12rem' },
        cell: ({ row }) =>
          canManage &&
          row.original.status === PARKED && (
            <span className="tw:flex tw:gap-inline">
              <Button
                variant="ghost"
                size="sm"
                aria-label={tOr('studio.adminDlqReplayFor', { job: row.original.jobId }, '')}
                onClick={() => setOpen({ action: 'replay', entry: row.original })}
              >
                {tOr('studio.adminDlqReplay', {}, '')}
              </Button>
              <Button
                variant="ghost"
                tone="danger"
                size="sm"
                aria-label={tOr('studio.adminDlqDiscardFor', { job: row.original.jobId }, '')}
                onClick={() => setOpen({ action: 'discard', entry: row.original })}
              >
                {tOr('studio.adminDlqDiscard', {}, '')}
              </Button>
            </span>
          ),
      }),
    ]),
    data: rows,
    getRowId: ({ id }) => id,
    enableRowSelection: false,
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <>
      <DataTable.Root
        table={table}
        state={state}
        fetching={entries.isFetching && !entries.isPending}
      >
        <DataTable.Caption>{tOr('studio.adminDlqCaption', {}, '')}</DataTable.Caption>
        <DataTable.Toolbar>
          <FilterSelect
            label={tOr('studio.adminDlqStatus', {}, '')}
            value={status}
            options={DLQ_STATUS_OPTIONS.map((value) => ({
              value,
              label: tOr('studio.adminDlqStatusName', { status: value }, ''),
            }))}
            onChange={(next) => navigate({ search: { status: next } })}
          />
        </DataTable.Toolbar>
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.adminDlqEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.adminDlqEmptyDescription', {}, '')}
              </EmptyState.Description>
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root onRetry={() => entries.refetch()} retrying={entries.isFetching}>
              <SectionError.Message>{tOr('studio.adminDlqFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      <LoadMore
        hasNextPage={entries.hasNextPage}
        fetching={entries.isFetchingNextPage}
        onLoadMore={() => entries.fetchNextPage()}
      />
      {open && <DlqActionDialog {...open} onClose={() => setOpen(undefined)} />}
    </>
  );
}

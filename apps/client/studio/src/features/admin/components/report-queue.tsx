import { useInfiniteQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { EmptyState, SectionError } from '@vp/components';
import { publishedAt } from '@vp/intl';
import { Format, useFormat, useT } from '@vp/intl-react';
import { canDeleteComment } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useApi } from '@vp/queries';
import { fromPromise, isOk, unwrapOr } from '@vp/result';
import { Button, useToast } from '@vp/ui';
import { useState } from 'react';

import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { type AdminReport, adminReportsQueryOptions } from '#app/features/admin/api/admin-reports';
import { pagedRows, tableStateOf } from '#app/features/admin/api/paged-rows';
import { useResolveReport } from '#app/features/admin/hooks/use-report-resolution';
import { LoadMore } from './load-more';
import { ReportRemoveDialog } from './report-remove-dialog';

const column = createColumnHelper<DataTableFeatures, AdminReport>();

const EXCERPT_GRAPHEMES = 60;

const stateOf = ({ resolution }: AdminReport) => resolution ?? 'open';

interface ReportActionsProps {
  report: AdminReport;
  onRemove: (report: AdminReport, excerpt: string) => void;
}

function ReportActions({ report, onRemove }: ReportActionsProps) {
  const { tOr } = useT();
  const { truncate } = useFormat();
  const toast = useToast();
  const resolve = useResolveReport();
  const { comment } = report;
  const canResolve = useCan(canDeleteComment, {
    comment: { id: comment.id, authorId: comment.authorId, videoId: comment.videoId },
    videoOwnerId: '',
  });

  if (!canResolve || report.resolvedAt !== null) {
    return null;
  }

  const excerpt = unwrapOr(truncate(comment.content, EXCERPT_GRAPHEMES), comment.content);

  const dismiss = async () => {
    const done = await fromPromise(
      () => resolve.mutateAsync({ id: report.id, resolution: 'dismissed' }),
      (cause) => cause
    );
    if (!isOk(done)) {
      toast({ tone: 'danger', title: tOr('studio.adminReportResolveFailed', {}, '') });
    }
  };

  return (
    <span className="tw:flex tw:gap-inline">
      <Button
        variant="ghost"
        size="sm"
        aria-label={tOr('studio.adminReportDismissFor', { comment: excerpt }, '')}
        onClick={dismiss}
      >
        {tOr('studio.adminReportDismiss', {}, '')}
      </Button>
      {!comment.removed && (
        <Button
          variant="ghost"
          tone="danger"
          size="sm"
          aria-label={tOr('studio.adminReportRemoveFor', { comment: excerpt }, '')}
          onClick={() => onRemove(report, excerpt)}
        >
          {tOr('studio.adminReportRemove', {}, '')}
        </Button>
      )}
    </span>
  );
}

/** The reported comments, open ones first, on the studio's `DataTable`, with what an admin may resolve. */
export function ReportQueue() {
  const { tOr } = useT();
  const reports = useInfiniteQuery({
    ...adminReportsQueryOptions(useApi()),
    select: pagedRows,
  });
  const [removing, setRemoving] = useState<{ reportId: string; excerpt: string }>();

  const rows = reports.data ?? [];
  const state = tableStateOf(reports, rows.length);

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.accessor((report) => report.comment.content, {
        id: 'comment',
        header: tOr('studio.adminReportComment', {}, ''),
        enableSorting: false,
        cell: ({ row }) => <span className="tw:line-clamp-2">{row.original.comment.content}</span>,
      }),
      column.accessor('reason', {
        header: tOr('studio.adminReportReason', {}, ''),
        enableSorting: false,
        cell: ({ row }) =>
          tOr('studio.adminReportReasonName', { reason: row.original.reason }, ''),
      }),
      column.accessor('note', {
        header: tOr('studio.adminReportNote', {}, ''),
        enableSorting: false,
        cell: ({ row }) => <span className="tw:line-clamp-2">{row.original.note}</span>,
      }),
      column.accessor(stateOf, {
        id: 'state',
        header: tOr('studio.adminReportStatus', {}, ''),
        enableSorting: false,
        cell: ({ row }) => tOr('studio.adminReportState', { state: stateOf(row.original) }, ''),
      }),
      column.accessor('createdAt', {
        header: tOr('studio.adminReportReported', {}, ''),
        enableSorting: false,
        cell: ({ row }) => (
          <time dateTime={row.original.createdAt}>
            <Format value={publishedAt(row.original.createdAt).relative} />
          </time>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.adminReportActions', {}, ''),
        meta: { width: '12rem' },
        cell: ({ row }) => (
          <ReportActions
            report={row.original}
            onRemove={({ id }, excerpt) => setRemoving({ reportId: id, excerpt })}
          />
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
        fetching={reports.isFetching && !reports.isPending}
      >
        <DataTable.Caption>{tOr('studio.adminReportsCaption', {}, '')}</DataTable.Caption>
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.adminReportsEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.adminReportsEmptyDescription', {}, '')}
              </EmptyState.Description>
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root onRetry={() => reports.refetch()} retrying={reports.isFetching}>
              <SectionError.Message>{tOr('studio.adminReportsFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      <LoadMore
        hasNextPage={reports.hasNextPage}
        fetching={reports.isFetchingNextPage}
        onLoadMore={() => reports.fetchNextPage()}
      />
      {removing && <ReportRemoveDialog {...removing} onClose={() => setRemoving(undefined)} />}
    </>
  );
}

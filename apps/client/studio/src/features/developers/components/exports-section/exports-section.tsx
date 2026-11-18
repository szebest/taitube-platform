import { Format, useT } from '@kit/intl-react';
import { Badge, type BadgeTone, Button, Icon, IconButton, Progress, useToast } from '@kit/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { DataExportView } from '@vp/api-contracts';
import { EmptyState, SectionError } from '@vp/components';
import { DATA_EXPORT_LIMITS, type DataExportKind, type DataExportStatus } from '@vp/domain';
import { publishedAt } from '@vp/intl-formats';
import { useApi, useFailureToast } from '@vp/queries';
import { useState } from 'react';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { LoadMore } from '#app/components/table/load-more';
import { exportsQueryOptions } from '#app/features/developers/api/developer-queries';
import {
  useDeleteExport,
  useExportDownload,
} from '#app/features/developers/hooks/use-developer-mutations';
import { useExportEvents } from '#app/features/developers/hooks/use-export-events';
import { pagedRows, tableStateOf } from '#app/utils/paged-rows';
import { DeveloperSection } from '../developer-section/developer-section';
import { RequestExportDialog } from '../request-export-dialog/request-export-dialog';

const column = createColumnHelper<DataTableFeatures, DataExportView>();
const NONE: readonly DataExportView[] = [];

/** How each status shows: its tone, whether the job is still writing, whether there is a file to fetch. */
const STATUS_VIEWS = {
  queued: { tone: 'neutral', working: true, downloadable: false },
  running: { tone: 'info', working: true, downloadable: false },
  ready: { tone: 'success', working: false, downloadable: true },
  failed: { tone: 'danger', working: false, downloadable: false },
  expired: { tone: 'neutral', working: false, downloadable: false },
} as const satisfies Record<
  DataExportStatus,
  { tone: BadgeTone; working: boolean; downloadable: boolean }
>;

export interface ExportsSectionProps {
  /** What the viewer's role may export from the acting channel; never empty here. */
  kinds: readonly DataExportKind[];
}

/** The acting channel's exports with their live status; request, download while ready, delete. */
export function ExportsSection({ kinds }: ExportsSectionProps) {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const exports = useInfiniteQuery({ ...exportsQueryOptions(useApi()), select: pagedRows });
  const remove = useDeleteExport();
  const download = useExportDownload();
  const [requesting, setRequesting] = useState(false);
  useExportEvents();

  const rows = exports.data ?? NONE;
  const kindOf = (kind: DataExportKind) => tOr('studio.exportKind', { kind }, kind);
  const rangeOf = ({ from, to }: DataExportView['params']) => {
    if (from && to) return tOr('studio.exportRangeBetween', { from, to }, '');
    if (from) return tOr('studio.exportRangeFrom', { from }, '');
    if (to) return tOr('studio.exportRangeTo', { to }, '');
    return tOr('studio.exportRangeAll', {}, '');
  };

  const fetchFile = (row: DataExportView) =>
    download.mutate(row.id, {
      onSuccess: ({ downloadUrl }) => {
        if (downloadUrl) window.open(downloadUrl, '_self');
        else toast({ tone: 'danger', title: tOr('studio.exportsDownloadFailed', {}, '') });
      },
      onError: (error) => showFailure(tOr('studio.exportsDownloadFailed', {}, ''), error),
    });

  const removeExport = (row: DataExportView) =>
    remove.mutate(row.id, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.exportsDeleted', {}, '') }),
      onError: (error) => showFailure(tOr('studio.exportsDeleteFailed', {}, ''), error),
    });

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.accessor('kind', {
        header: tOr('studio.exportsColumnKind', {}, ''),
        cell: ({ row: { original } }) => (
          <span className="flex flex-wrap items-center gap-inline">
            <span className="text-label">{kindOf(original.kind)}</span>
            <Badge size="sm" variant="outline">
              {tOr('studio.exportFormat', { format: original.format }, '')}
            </Badge>
          </span>
        ),
      }),
      column.display({
        id: 'range',
        header: tOr('studio.exportsColumnRange', {}, ''),
        cell: ({ row: { original } }) => <span>{rangeOf(original.params)}</span>,
      }),
      column.accessor('status', {
        header: tOr('studio.exportsColumnStatus', {}, ''),
        meta: { width: '11rem' },
        cell: ({ row: { original } }) => {
          const label = tOr('studio.exportStatus', { status: original.status }, '');
          return (
            <span className="flex flex-col items-start gap-1">
              <Badge size="sm" tone={STATUS_VIEWS[original.status].tone}>
                {label}
              </Badge>
              {STATUS_VIEWS[original.status].working && (
                <Progress aria-label={label} className="w-24" />
              )}
              {original.rowCount !== null && (
                <span className="text-caption text-fg-muted">
                  {tOr('studio.exportRows', { count: original.rowCount }, '')}
                </span>
              )}
              {original.failure && (
                <span className="text-caption text-fg-muted">{original.failure}</span>
              )}
            </span>
          );
        },
      }),
      column.accessor('createdAt', {
        header: tOr('studio.exportsColumnRequested', {}, ''),
        meta: { width: '9rem' },
        cell: ({ row: { original } }) => (
          <time dateTime={original.createdAt}>
            <Format value={publishedAt(original.createdAt).relative} />
          </time>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.exportsColumnActions', {}, ''),
        meta: { width: '11rem' },
        cell: ({ row: { original } }) => (
          <span className="flex items-center gap-inline">
            {STATUS_VIEWS[original.status].downloadable && (
              <Button
                variant="outline"
                size="sm"
                loading={download.isPending && download.variables === original.id}
                aria-label={tOr('studio.exportsDownloadLabel', { kind: kindOf(original.kind) }, '')}
                onClick={() => fetchFile(original)}
              >
                {tOr('studio.exportsDownload', {}, '')}
              </Button>
            )}
            <IconButton
              size="sm"
              aria-label={tOr('studio.exportsDelete', { kind: kindOf(original.kind) }, '')}
              onClick={() => removeExport(original)}
            >
              <Icon name="trash" />
            </IconButton>
          </span>
        ),
      }),
    ]),
    data: rows,
    getRowId: ({ id }) => id,
    enableRowSelection: false,
    enableSorting: false,
    manualPagination: true,
  });

  const state = tableStateOf(exports, rows.length);

  return (
    <DeveloperSection
      title={tOr('studio.exportsTitle', {}, '')}
      description={tOr('studio.exportsDescription', { days: DATA_EXPORT_LIMITS.ttlDays }, '')}
      action={
        <Button variant="solid" tone="accent" size="sm" onClick={() => setRequesting(true)}>
          <Icon name="plus" />
          {tOr('studio.exportsRequest', {}, '')}
        </Button>
      }
    >
      <DataTable.Root
        table={table}
        state={state}
        fetching={exports.isFetching && !exports.isPending}
      >
        <DataTable.Caption>{tOr('studio.exportsCaption', {}, '')}</DataTable.Caption>
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.exportsEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.exportsEmptyDescription', {}, '')}
              </EmptyState.Description>
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root onRetry={() => exports.refetch()} retrying={exports.isFetching}>
              <SectionError.Message>{tOr('studio.exportsFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      <LoadMore
        hasNextPage={exports.hasNextPage}
        fetching={exports.isFetchingNextPage}
        onLoadMore={() => exports.fetchNextPage()}
      />
      {requesting && <RequestExportDialog kinds={kinds} onClose={() => setRequesting(false)} />}
    </DeveloperSection>
  );
}

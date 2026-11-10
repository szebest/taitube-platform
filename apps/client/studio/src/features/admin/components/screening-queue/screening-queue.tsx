import { useInfiniteQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import { EmptyState, SectionError, VideoThumbnail } from '@vp/components';
import { publishedAt } from '@vp/intl';
import { Format, useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Button } from '@vp/ui';
import { useState } from 'react';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { FilterSelect } from '#app/components/table/filter-select';
import { LoadMore } from '#app/components/table/load-more';
import {
  adminScreeningQueryOptions,
  SCREENING_STATE_OPTIONS,
  type ScreeningCase,
  screeningStateOf,
} from '#app/features/admin/api/admin-screening';
import { useSecondsRange, useShare } from '#app/features/admin/hooks/use-screening-format';
import { pagedRows, tableStateOf } from '#app/utils/paged-rows';
import { ScreeningActions } from '../screening-actions/screening-actions';
import { ScreeningEvidenceDialog } from '../screening-evidence-dialog/screening-evidence-dialog';

const route = getRouteApi('/_authed/admin/screening');
const column = createColumnHelper<DataTableFeatures, ScreeningCase>();

const matchOf = ({ reasons, flags }: ScreeningCase) =>
  [...reasons, ...flags].find(({ match }) => match !== null)?.match ?? null;

function ScreeningMatch({ screening }: { screening: ScreeningCase }) {
  const { tOr } = useT();
  const rangeText = useSecondsRange();
  const match = matchOf(screening);

  if (!match) {
    return <span className="text-fg-muted">{tOr('studio.screeningMatchNone', {}, '')}</span>;
  }

  return (
    <div className="flex items-center gap-stack">
      <VideoThumbnail.Root className="w-row-thumb shrink-0">
        <VideoThumbnail.Image src={match.thumbnailUrl} />
      </VideoThumbnail.Root>
      <div className="flex min-w-0 flex-col text-caption">
        <span className="truncate text-label">
          {match.title ?? tOr('studio.screeningMatchGone', {}, '')}
        </span>
        <span className="truncate text-fg-muted">{match.channel?.displayName}</span>
        {match.sourceRange && <span>{rangeText(match.sourceRange)}</span>}
      </div>
    </div>
  );
}

/** The cases the upload check held or flagged, open ones first, with the evidence one click away and what a moderator may decide. */
export function ScreeningQueue() {
  const { tOr } = useT();
  const share = useShare();
  const { state: filter } = route.useSearch();
  const navigate = route.useNavigate();
  const cases = useInfiniteQuery({
    ...adminScreeningQueryOptions(useApi(), filter),
    select: pagedRows,
  });
  const [inspecting, setInspecting] = useState<ScreeningCase>();

  const rows = cases.data ?? [];
  const state = tableStateOf(cases, rows.length);

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.accessor((screening) => screening.title ?? '', {
        id: 'video',
        header: tOr('studio.screeningColVideo', {}, ''),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-stack">
            <VideoThumbnail.Root className="w-row-thumb shrink-0">
              <VideoThumbnail.Image src={row.original.thumbnailUrl} />
            </VideoThumbnail.Root>
            <div className="flex min-w-0 flex-col text-caption">
              <span className="truncate text-label">
                {row.original.title ?? tOr('browse.untitled', {}, '')}
              </span>
              <span className="truncate text-fg-muted">{row.original.channel?.displayName}</span>
            </div>
          </div>
        ),
      }),
      column.accessor('score', {
        header: tOr('studio.screeningColScore', {}, ''),
        enableSorting: false,
        meta: { numeric: true, width: '6rem' },
        cell: ({ row }) => share(row.original.score),
      }),
      column.accessor((screening) => screening.reasons.length, {
        id: 'reasons',
        header: tOr('studio.screeningColReasons', {}, ''),
        enableSorting: false,
        cell: ({ row }) => (
          <ul className="m-0 list-none p-0">
            {[...row.original.reasons, ...row.original.flags].map(({ reason }) => (
              <li key={reason}>{tOr('studio.screeningReasonName', { reason }, '')}</li>
            ))}
          </ul>
        ),
      }),
      column.display({
        id: 'match',
        header: tOr('studio.screeningColMatch', {}, ''),
        cell: ({ row }) => <ScreeningMatch screening={row.original} />,
      }),
      column.accessor(screeningStateOf, {
        id: 'state',
        header: tOr('studio.screeningColState', {}, ''),
        enableSorting: false,
        cell: ({ row }) =>
          tOr('studio.screeningStateName', { state: screeningStateOf(row.original) }, ''),
      }),
      column.accessor('createdAt', {
        header: tOr('studio.screeningColCreated', {}, ''),
        enableSorting: false,
        cell: ({ row }) => (
          <time dateTime={row.original.createdAt}>
            <Format value={publishedAt(row.original.createdAt).relative} />
          </time>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.screeningColActions', {}, ''),
        meta: { width: '16rem' },
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-inline">
            <Button
              variant="ghost"
              size="sm"
              aria-label={tOr(
                'studio.screeningEvidenceFor',
                { title: row.original.title ?? tOr('browse.untitled', {}, '') },
                ''
              )}
              onClick={() => setInspecting(row.original)}
            >
              {tOr('studio.screeningEvidence', {}, '')}
            </Button>
            <ScreeningActions screening={row.original} />
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
      <DataTable.Root table={table} state={state} fetching={cases.isFetching && !cases.isPending}>
        <DataTable.Caption>{tOr('studio.screeningCaption', {}, '')}</DataTable.Caption>
        <DataTable.Toolbar>
          <FilterSelect
            label={tOr('studio.screeningFilter', {}, '')}
            value={filter}
            options={SCREENING_STATE_OPTIONS.map((value) => ({
              value,
              label: tOr('studio.screeningFilterOption', { state: value }, ''),
            }))}
            onChange={(next) => navigate({ search: { state: next }, replace: true })}
          />
        </DataTable.Toolbar>
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.screeningEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.screeningEmptyDescription', {}, '')}
              </EmptyState.Description>
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root onRetry={() => cases.refetch()} retrying={cases.isFetching}>
              <SectionError.Message>{tOr('studio.screeningFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      <LoadMore
        hasNextPage={cases.hasNextPage}
        fetching={cases.isFetchingNextPage}
        onLoadMore={() => cases.fetchNextPage()}
      />
      {inspecting && (
        <ScreeningEvidenceDialog screening={inspecting} onClose={() => setInspecting(undefined)} />
      )}
    </>
  );
}

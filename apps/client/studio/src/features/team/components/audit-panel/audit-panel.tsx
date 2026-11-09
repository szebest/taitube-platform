import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { EmptyState, SectionError } from '@vp/components';
import { CHANNEL_AUDIT_ACTIONS } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { Skeleton } from '@vp/ui';
import { AuditLogList } from '#app/components/team/audit-log-list';
import { pagedRows } from '#app/features/admin/api/paged-rows';
import { FilterSelect } from '#app/features/admin/components/filter-select/filter-select';
import { LoadMore } from '#app/features/admin/components/load-more/load-more';
import {
  type AuditFilters,
  auditQueryOptions,
  teamQueryOptions,
} from '#app/features/team/api/team-queries';
import { AuditEntry } from '../audit-entry/audit-entry';

export interface AuditPanelProps {
  filters: AuditFilters;
  onFiltersChange: (filters: AuditFilters) => void;
}

/** The acting channel's audit log, newest first, narrowed by who did it and what it was. */
export function AuditPanel({ filters, onFiltersChange }: AuditPanelProps) {
  const { tOr } = useT();
  const api = useApi();
  const account = useAccount();
  const team = useQuery(teamQueryOptions(api));
  const log = useInfiniteQuery({ ...auditQueryOptions(api, filters), select: pagedRows });
  const entries = log.data ?? [];

  const actors = [
    ...(account ? [{ value: account.user.id, label: account.channel.displayName }] : []),
    ...(team.data?.members ?? []).flatMap(({ userId, profile }) =>
      profile ? [{ value: userId, label: profile.displayName }] : []
    ),
  ];

  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-wrap items-end gap-inline">
        <FilterSelect
          label={tOr('studio.teamAuditFilterActor', {}, '')}
          value={filters.actorUserId}
          options={actors}
          onChange={(actorUserId) => onFiltersChange({ ...filters, actorUserId })}
        />
        <FilterSelect
          label={tOr('studio.teamAuditFilterAction', {}, '')}
          value={filters.action}
          options={CHANNEL_AUDIT_ACTIONS.map((action) => ({
            value: action,
            label: tOr('studio.teamAuditAction', { action }, action),
          }))}
          onChange={(action) => onFiltersChange({ ...filters, action })}
        />
      </div>
      {log.isPending && <Skeleton className="h-40 w-full" />}
      {log.isError && entries.length === 0 && (
        <SectionError.Root onRetry={() => log.refetch()} retrying={log.isFetching}>
          <SectionError.Message>{tOr('studio.teamAuditFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {log.isSuccess && entries.length === 0 && (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.teamAuditEmptyTitle', {}, '')}</EmptyState.Title>
          <EmptyState.Description>
            {tOr('studio.teamAuditEmptyDescription', {}, '')}
          </EmptyState.Description>
        </EmptyState.Root>
      )}
      {entries.length > 0 && (
        <AuditLogList.Root aria-label={tOr('studio.teamAuditEntries', {}, '')}>
          {entries.map((entry) => (
            <AuditEntry key={entry.id} entry={entry} />
          ))}
        </AuditLogList.Root>
      )}
      <LoadMore
        hasNextPage={log.hasNextPage}
        fetching={log.isFetchingNextPage}
        onLoadMore={() => void log.fetchNextPage()}
      />
    </div>
  );
}

import { Format, useFormat, useT } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Badge, Button, Icon, IconButton, useToast } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { ApiTokenView } from '@vp/api-contracts';
import { EmptyState, SectionError } from '@vp/components';
import { API_TOKEN_LIMITS, type ApiTokenStatus } from '@vp/domain';
import { API_TOKEN } from '@vp/domain-rules';
import { publishedAt } from '@vp/intl-formats';
import { useApi, useFailureToast } from '@vp/queries';
import { useState } from 'react';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { apiTokensQueryOptions } from '#app/features/developers/api/developer-queries';
import { useRevokeToken } from '#app/features/developers/hooks/use-developer-mutations';
import { tableStateOf } from '#app/utils/paged-rows';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { CreateTokenDialog } from '../create-token-dialog/create-token-dialog';
import { DeveloperSection } from '../developer-section/developer-section';

const column = createColumnHelper<DataTableFeatures, ApiTokenView>();
const NONE: readonly ApiTokenView[] = [];
const usable = (status: ApiTokenStatus) => API_TOKEN.next(status, 'use') !== undefined;

/** The viewer's tokens with what each may do, when it was last used and when it ends; create and revoke. */
export function TokensSection() {
  const { tOr } = useT();
  const { format } = useFormat();
  const toast = useToast();
  const showFailure = useFailureToast();
  const tokens = useQuery(apiTokensQueryOptions(useApi()));
  const revoke = useRevokeToken();
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ApiTokenView>();

  const rows = tokens.data?.items ?? NONE;
  const atLimit =
    rows.filter(({ status }) => usable(status)).length >= API_TOKEN_LIMITS.activePerUser;
  const day = (iso: string) =>
    unwrapOr(
      format({
        type: 'date',
        value: iso,
        options: { year: 'numeric', month: 'short', day: 'numeric' },
      }),
      iso
    );

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.accessor('name', {
        header: tOr('studio.tokensColumnName', {}, ''),
        cell: ({ row: { original } }) => (
          <span className="flex flex-col">
            <span className="text-label">{original.name}</span>
            <code className="font-mono text-caption text-fg-muted">tt_pat_{original.prefix}</code>
          </span>
        ),
      }),
      column.display({
        id: 'scopes',
        header: tOr('studio.tokensColumnScopes', {}, ''),
        cell: ({ row: { original } }) => (
          <span className="flex flex-wrap gap-1">
            {original.scopes.map((scope) => (
              <Badge key={scope} size="sm" variant="soft" className="font-mono">
                {scope}
              </Badge>
            ))}
          </span>
        ),
      }),
      column.display({
        id: 'lastUsed',
        header: tOr('studio.tokensColumnLastUsed', {}, ''),
        meta: { width: '11rem' },
        cell: ({ row: { original } }) =>
          original.lastUsedAt === null ? (
            <span className="text-caption text-fg-muted">
              {tOr('studio.tokensNeverUsed', {}, '')}
            </span>
          ) : (
            <span className="flex flex-col">
              <time dateTime={original.lastUsedAt}>
                <Format value={publishedAt(original.lastUsedAt).relative} />
              </time>
              <span className="text-caption text-fg-muted">
                {tOr('studio.tokensRequestsToday', { count: original.requestsToday }, '')}
              </span>
            </span>
          ),
      }),
      column.display({
        id: 'expires',
        header: tOr('studio.tokensColumnExpires', {}, ''),
        meta: { width: '10rem' },
        cell: ({ row: { original } }) => (
          <span className="flex flex-col items-start gap-1">
            <time dateTime={original.expiresAt}>{day(original.expiresAt)}</time>
            {!usable(original.status) && (
              <Badge size="sm" tone="warning">
                {tOr('studio.tokensStatus', { status: original.status }, '')}
              </Badge>
            )}
          </span>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.tokensColumnActions', {}, ''),
        meta: { width: '6rem' },
        cell: ({ row: { original } }) => (
          <IconButton
            size="sm"
            aria-label={tOr('studio.tokensRevoke', { name: original.name }, '')}
            onClick={() => setRevoking(original)}
          >
            <Icon name="trash" />
          </IconButton>
        ),
      }),
    ]),
    data: rows,
    getRowId: ({ id }) => id,
    enableRowSelection: false,
    enableSorting: false,
    manualPagination: true,
  });

  const state = tableStateOf(tokens, rows.length);
  const confirmRevoke = (token: ApiTokenView) =>
    revoke.mutate(token.id, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.tokensRevoked', {}, '') }),
      onError: (error) => showFailure(tOr('studio.tokensRevokeFailed', {}, ''), error),
    });

  return (
    <DeveloperSection
      title={tOr('studio.tokensTitle', {}, '')}
      description={tOr('studio.tokensDescription', {}, '')}
      action={
        <Button
          variant="solid"
          tone="accent"
          size="sm"
          disabled={atLimit}
          onClick={() => setCreating(true)}
        >
          <Icon name="plus" />
          {tOr('studio.tokensCreate', {}, '')}
        </Button>
      }
    >
      {atLimit && (
        <p className="m-0 text-caption text-fg-muted">
          {tOr('studio.tokensAtLimit', { count: API_TOKEN_LIMITS.activePerUser }, '')}
        </p>
      )}
      <DataTable.Root table={table} state={state} fetching={tokens.isFetching && !tokens.isPending}>
        <DataTable.Caption>{tOr('studio.tokensCaption', {}, '')}</DataTable.Caption>
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.tokensEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.tokensEmptyDescription', {}, '')}
              </EmptyState.Description>
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root onRetry={() => tokens.refetch()} retrying={tokens.isFetching}>
              <SectionError.Message>{tOr('studio.tokensFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      {creating && <CreateTokenDialog onClose={() => setCreating(false)} />}
      {revoking && (
        <ConfirmDialog
          title={tOr('studio.tokensRevokeTitle', { name: revoking.name }, '')}
          description={tOr('studio.tokensRevokeDescription', {}, '')}
          confirm={tOr('studio.tokensRevokeConfirm', {}, '')}
          onConfirm={() => confirmRevoke(revoking)}
          onClose={() => setRevoking(undefined)}
        />
      )}
    </DeveloperSection>
  );
}

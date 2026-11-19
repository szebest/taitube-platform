import { EmptyState, SectionError } from '@kit/components';
import { Format, useT } from '@kit/intl-react';
import { assertNever } from '@kit/result';
import { Badge, Button, Icon, IconButton, useToast } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper, useTable } from '@tanstack/react-table';
import type { WebhookTestView, WebhookView } from '@vp/api-contracts';
import { publishedAt } from '@vp/intl-formats';
import { useApi, useFailureToast } from '@vp/queries';
import { useState } from 'react';
import {
  DataTable,
  type DataTableFeatures,
  dataTableFeatures,
} from '#app/components/table/data-table';
import { webhooksQueryOptions } from '#app/features/developers/api/developer-queries';
import {
  useDeleteWebhook,
  useTestWebhook,
} from '#app/features/developers/hooks/use-developer-mutations';
import { tableStateOf } from '#app/utils/paged-rows';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { CreateWebhookDialog } from '../create-webhook-dialog/create-webhook-dialog';
import { DeveloperSection } from '../developer-section/developer-section';

const column = createColumnHelper<DataTableFeatures, WebhookView>();
const NONE: readonly WebhookView[] = [];

/** The viewer's webhooks with the events each hears about; add, send a test, remove. */
export function WebhooksSection() {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const webhooks = useQuery(webhooksQueryOptions(useApi()));
  const remove = useDeleteWebhook();
  const test = useTestWebhook();
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<WebhookView>();

  const rows = webhooks.data?.items ?? NONE;

  const announce = (url: string, result: WebhookTestView) => {
    switch (result.outcome) {
      case 'delivered':
        return toast({ tone: 'success', title: tOr('studio.webhooksTestDelivered', { url }, '') });
      case 'failed':
        return toast({
          tone: 'danger',
          title: tOr('studio.webhooksTestRefused', { url }, ''),
          description:
            result.status === null
              ? tOr('studio.webhooksTestReason', { reason: result.reason }, '')
              : tOr('studio.webhooksTestStatus', { status: result.status }, ''),
        });
      default:
        return assertNever(result, 'WebhookTestView');
    }
  };

  const sendTest = ({ id, url }: WebhookView) =>
    test.mutate(id, {
      onSuccess: (result) => announce(url, result),
      onError: (error) => showFailure(tOr('studio.webhooksTestFailed', {}, ''), error),
    });

  const table = useTable({
    features: dataTableFeatures,
    columns: column.columns([
      column.accessor('url', {
        header: tOr('studio.webhooksColumnUrl', {}, ''),
        cell: ({ row: { original } }) => (
          <code className="break-all font-mono text-body-sm">{original.url}</code>
        ),
      }),
      column.display({
        id: 'events',
        header: tOr('studio.webhooksColumnEvents', {}, ''),
        cell: ({ row: { original } }) => (
          <span className="flex flex-wrap gap-1">
            {original.events.map((event) => (
              <Badge key={event} size="sm" variant="soft">
                {tOr('studio.webhookEvent', { event }, event)}
              </Badge>
            ))}
          </span>
        ),
      }),
      column.accessor('createdAt', {
        header: tOr('studio.webhooksColumnCreated', {}, ''),
        meta: { width: '9rem' },
        cell: ({ row: { original } }) => (
          <time dateTime={original.createdAt}>
            <Format value={publishedAt(original.createdAt).relative} />
          </time>
        ),
      }),
      column.display({
        id: 'actions',
        header: tOr('studio.webhooksColumnActions', {}, ''),
        meta: { width: '12rem' },
        cell: ({ row: { original } }) => (
          <span className="flex items-center gap-inline">
            <Button
              variant="outline"
              size="sm"
              loading={test.isPending && test.variables === original.id}
              aria-label={tOr('studio.webhooksSendTestLabel', { url: original.url }, '')}
              onClick={() => sendTest(original)}
            >
              {tOr('studio.webhooksSendTest', {}, '')}
            </Button>
            <IconButton
              size="sm"
              aria-label={tOr('studio.webhooksDelete', { url: original.url }, '')}
              onClick={() => setRemoving(original)}
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

  const state = tableStateOf(webhooks, rows.length);
  const confirmRemove = ({ id }: WebhookView) =>
    remove.mutate(id, {
      onSuccess: () => toast({ tone: 'success', title: tOr('studio.webhooksDeleted', {}, '') }),
      onError: (error) => showFailure(tOr('studio.webhooksDeleteFailed', {}, ''), error),
    });

  return (
    <DeveloperSection
      title={tOr('studio.webhooksTitle', {}, '')}
      description={tOr('studio.webhooksDescription', {}, '')}
      action={
        <Button variant="solid" tone="accent" size="sm" onClick={() => setCreating(true)}>
          <Icon name="plus" />
          {tOr('studio.webhooksCreate', {}, '')}
        </Button>
      }
    >
      <DataTable.Root
        table={table}
        state={state}
        fetching={webhooks.isFetching && !webhooks.isPending}
      >
        <DataTable.Caption>{tOr('studio.webhooksCaption', {}, '')}</DataTable.Caption>
        <DataTable.Header />
        <DataTable.Body>
          {state === 'empty' && (
            <EmptyState.Root size="section">
              <EmptyState.Title>{tOr('studio.webhooksEmptyTitle', {}, '')}</EmptyState.Title>
              <EmptyState.Description>
                {tOr('studio.webhooksEmptyDescription', {}, '')}
              </EmptyState.Description>
            </EmptyState.Root>
          )}
          {state === 'error' && (
            <SectionError.Root onRetry={() => webhooks.refetch()} retrying={webhooks.isFetching}>
              <SectionError.Message>{tOr('studio.webhooksFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          )}
        </DataTable.Body>
      </DataTable.Root>
      {creating && <CreateWebhookDialog onClose={() => setCreating(false)} />}
      {removing && (
        <ConfirmDialog
          title={tOr('studio.webhooksDeleteTitle', {}, '')}
          description={tOr('studio.webhooksDeleteDescription', { url: removing.url }, '')}
          confirm={tOr('studio.webhooksDeleteConfirm', {}, '')}
          onConfirm={() => confirmRemove(removing)}
          onClose={() => setRemoving(undefined)}
        />
      )}
    </DeveloperSection>
  );
}

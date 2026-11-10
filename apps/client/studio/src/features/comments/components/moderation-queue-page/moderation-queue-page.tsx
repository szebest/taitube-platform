import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { BulkActionBody } from '@vp/api-contracts';
import { EmptyState, PageHeader, SectionError } from '@vp/components';
import { DEFAULT_DISCLOSURE, type Disclosure } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { canReadCommentSettings } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { commentSettingsQueryOptions, useApi } from '@vp/queries';
import { Badge, Spinner } from '@vp/ui';
import { useState } from 'react';
import { ModerationQueue } from '#app/components/comments/moderation-queue';
import { LoadMore } from '#app/components/table/load-more';
import { inboxQueryOptions } from '#app/features/comments/api/inbox-queries';
import { useBulkModeration } from '#app/features/comments/hooks/use-bulk-moderation';
import { useModerationAbilities } from '#app/features/comments/hooks/use-moderation-abilities';
import {
  type ModerationChannel,
  ModerationChannelProvider,
  useModerationChannel,
} from '#app/features/comments/hooks/use-moderation-channel';
import {
  type QueueShortcuts,
  useQueueShortcuts,
} from '#app/features/comments/hooks/use-queue-shortcuts';
import { reasonedAction } from '#app/features/comments/utils/reasoned-action';
import { pagedRows } from '#app/utils/paged-rows';
import { CommentSettingsLink } from '../comment-settings-link/comment-settings-link';
import {
  type ModerationReason,
  ModerationReasonDialog,
  type ReasonedAction,
} from '../moderation-reason-dialog/moderation-reason-dialog';
import { QueueActions } from '../queue-actions/queue-actions';
import { QueueDetail } from '../queue-detail/queue-detail';
import { QueueHelpDialog } from '../queue-help-dialog/queue-help-dialog';

const opposite = (disclosure: Disclosure): Disclosure =>
  disclosure === 'silent' ? 'visible' : 'silent';

function ModerationQueueBoard() {
  const api = useApi();
  const { tOr } = useT();
  const channel = useModerationChannel();
  const abilities = useModerationAbilities();
  const { run, pending } = useBulkModeration();
  const held = useInfiniteQuery({ ...inboxQueryOptions(api, 'held'), select: pagedRows });
  const canReadSettings = useCan(canReadCommentSettings, { channel });
  const settings = useQuery({ ...commentSettingsQueryOptions(api), enabled: canReadSettings });

  const [activeId, setActiveId] = useState<string>();
  const [marked, setMarked] = useState<ReadonlySet<string>>(new Set());
  const [flip, setFlip] = useState<Disclosure>();
  const [asking, setAsking] = useState<ReasonedAction | null>(null);
  const [helping, setHelping] = useState(false);

  const rows = held.data ?? [];
  const index = Math.max(
    rows.findIndex(({ id }) => id === activeId),
    0
  );
  const active = rows[index];
  const markedRows = rows.filter(({ id }) => marked.has(id));
  const targets = markedRows.length > 0 ? markedRows : active ? [active] : [];

  const defaults = settings.data?.disclosure ?? DEFAULT_DISCLOSURE;
  const hide = flip ?? defaults.hide;
  const remove = flip ?? defaults.remove;

  const apply = async (action: BulkActionBody) => {
    const ids = targets.map(({ id }) => id);
    setActiveId((rows[index + 1] ?? rows[index - 1])?.id);
    setMarked(new Set());
    setFlip(undefined);
    await run(ids, action);
  };

  const confirm = (details: ModerationReason) => {
    const action = asking;
    setAsking(null);
    if (action !== null) {
      const label = tOr('studio.moderationReasonOption', { reason: details.reason }, '');
      void apply(reasonedAction(action, details, action === 'hide' ? hide : remove, label));
    }
  };

  const shortcuts: QueueShortcuts = {
    j: () => setActiveId(rows[index + 1]?.id ?? active?.id),
    k: () => setActiveId(rows[index - 1]?.id ?? active?.id),
    a: () => abilities.approve && active && void apply({ action: 'approve' }),
    r: () => abilities.remove && active && setAsking('remove'),
    h: () => {
      if (!(abilities.hide && active)) return;
      if (hide === 'visible') setAsking('hide');
      else void apply({ action: 'hide', disclosure: 'silent' });
    },
    b: () => abilities.restrict && active && setAsking('ban'),
    v: () => setFlip(opposite(hide)),
    x: () => {
      if (!active) return;
      const next = new Set(marked);
      if (!next.delete(active.id)) next.add(active.id);
      setMarked(next);
    },
    '?': () => setHelping(true),
  };

  useQueueShortcuts(shortcuts, asking === null && !helping);

  const authorOf = ({ author }: (typeof rows)[number]) => author.displayName ?? author.handle ?? '';

  return (
    <div className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('studio.queueTitle', {}, '')}</h1>
        </PageHeader.Title>
        <PageHeader.Actions>
          <CommentSettingsLink />
        </PageHeader.Actions>
      </PageHeader.Root>
      {held.isPending && <Spinner />}
      {held.isError && rows.length === 0 && (
        <SectionError.Root onRetry={() => held.refetch()} retrying={held.isFetching}>
          <SectionError.Message>{tOr('studio.queueFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {held.isSuccess && rows.length === 0 && (
        <EmptyState.Root size="section">
          <EmptyState.Title>{tOr('studio.queueEmptyTitle', {}, '')}</EmptyState.Title>
          <EmptyState.Description>
            {tOr('studio.queueEmptyDescription', {}, '')}
          </EmptyState.Description>
        </EmptyState.Root>
      )}
      {active && (
        <div className="grid items-start gap-section expanded:grid-cols-[minmax(16rem,24rem)_1fr]">
          <div className="flex flex-col gap-stack">
            <ModerationQueue.Root
              aria-label={tOr('studio.queueListLabel', {}, '')}
              active={active.id}
              onActiveChange={setActiveId}
              selected={marked}
            >
              {rows.map((row) => (
                <ModerationQueue.Item key={row.id} value={row.id}>
                  <span className="text-label">{authorOf(row)}</span>
                  <span className="line-clamp-2 text-body-sm text-fg-muted">{row.content}</span>
                  <span className="flex items-center gap-inline text-caption text-fg-subtle">
                    <Badge size="sm" tone="warning">
                      {tOr(
                        'studio.queueHeldReason',
                        { reason: row.moderation?.heldReason ?? 'unknown' },
                        ''
                      )}
                    </Badge>
                    <span className="truncate">{row.video.title}</span>
                  </span>
                </ModerationQueue.Item>
              ))}
            </ModerationQueue.Root>
            <LoadMore
              hasNextPage={held.hasNextPage}
              fetching={held.isFetchingNextPage}
              onLoadMore={() => held.fetchNextPage()}
            />
          </div>
          <div className="flex flex-col gap-stack">
            <QueueDetail comment={active} />
            {markedRows.length > 0 && (
              <p role="status" className="m-0 text-body-sm text-fg-muted">
                {tOr('studio.queueSelection', { count: markedRows.length }, '')}
              </p>
            )}
            <QueueActions
              abilities={abilities}
              hide={hide}
              remove={remove}
              flipped={opposite(hide)}
              selected={marked.has(active.id)}
              pending={pending}
              canMovePrevious={index > 0}
              canMoveNext={index < rows.length - 1}
              onKey={(key) => shortcuts[key]()}
            />
          </div>
        </div>
      )}
      <ModerationReasonDialog
        action={asking}
        pending={pending}
        onConfirm={confirm}
        onCancel={() => setAsking(null)}
      />
      <QueueHelpDialog open={helping} onOpenChange={setHelping} />
    </div>
  );
}

export interface ModerationQueuePageProps {
  channel: ModerationChannel;
}

/** One held comment at a time with its video, why it was held and what its author wrote before; every action is a key and a button. */
export function ModerationQueuePage({ channel }: ModerationQueuePageProps) {
  return (
    <ModerationChannelProvider channel={channel}>
      <ModerationQueueBoard />
    </ModerationChannelProvider>
  );
}

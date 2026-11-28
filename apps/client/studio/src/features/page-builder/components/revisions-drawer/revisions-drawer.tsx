import { EmptyState } from '@kit/components';
import { Drawer, useToast } from '@kit/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useApi, useFailureToast } from '@vp/queries';
import { RevisionList } from '#app/components/history/revision-list';
import { LoadMore } from '#app/components/table/load-more';
import { pageRevisionsQueryOptions } from '#app/features/page-builder/api/page-queries';
import { useRestoreRevision } from '#app/features/page-builder/hooks/use-page-mutations';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';
import { pagedRows } from '#app/utils/paged-rows';

export interface RevisionsDrawerProps {
  onClose: () => void;
}

/** The published layouts, newest first, each one a way back: restoring publishes it again as a new revision. */
export function RevisionsDrawer({ onClose }: RevisionsDrawerProps) {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const { channelId } = useActiveChannel();
  const restore = useRestoreRevision();
  const revisions = useInfiniteQuery({
    ...pageRevisionsQueryOptions(useApi(), channelId),
    select: pagedRows,
  });
  const rows = revisions.data ?? [];

  return (
    <Drawer.Root open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content size="md">
        <Drawer.Header>
          <Drawer.Title>{tOr('studio.pageRevisionsTitle', {}, '')}</Drawer.Title>
          <Drawer.Description>{tOr('studio.pageRevisionsDescription', {}, '')}</Drawer.Description>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-stack">
          {rows.length === 0 && !revisions.isPending && (
            <EmptyState.Root>
              <EmptyState.Title>{tOr('studio.pageRevisionsEmpty', {}, '')}</EmptyState.Title>
            </EmptyState.Root>
          )}
          <RevisionList
            aria-label={tOr('studio.pageRevisionsLabel', {}, '')}
            pending={restore.isPending}
            items={rows.map((revision, index) => ({
              id: revision.id,
              version: revision.version,
              createdAt: revision.createdAt,
              restoredFromVersion: revision.restoredFromVersion,
              changedFields: null,
              note: revision.note ?? tOr('studio.pageRevisionNoNote', {}, ''),
              current: index === 0,
            }))}
            onRestore={({ id, version }) =>
              restore.mutate(id, {
                onSuccess: () =>
                  toast({ tone: 'success', title: tOr('studio.pageRestored', { version }, '') }),
                onError: (error) => showFailure(tOr('studio.pageRestoreFailed', {}, ''), error),
              })
            }
          />
          <LoadMore
            hasNextPage={revisions.hasNextPage}
            fetching={revisions.isFetchingNextPage}
            onLoadMore={() => void revisions.fetchNextPage()}
          />
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}

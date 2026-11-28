import { EmptyState } from '@kit/components';
import { ResponsiveModal, Skeleton, useToast } from '@kit/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { ManagedPostView } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { failureCode, useApi, useFailureToast } from '@vp/queries';
import { useState } from 'react';
import { VersionConflictDialog } from '#app/components/dialogs/version-conflict-dialog';
import { RevisionList, type RevisionListItem } from '#app/components/history/revision-list';
import { LoadMore } from '#app/components/table/load-more';
import { postHistoryQueryOptions } from '#app/features/posts/api/post-queries';
import { useRestorePostRevision } from '#app/features/posts/hooks/use-post-mutations';
import { payloadExcerpt, postExcerpt } from '#app/features/posts/utils/post-excerpt';
import { useActiveChannel } from '#app/hooks/use-active-channel';
import { useT } from '#app/lib/messages';
import { pagedRows } from '#app/utils/paged-rows';

export interface PostHistoryDialogProps {
  post: ManagedPostView;
  onClose: () => void;
}

/** The saved states of a published post, each with a way back to it as a new edit under the post's current version. */
export function PostHistoryDialog({ post, onClose }: PostHistoryDialogProps) {
  const { tOr } = useT();
  const toast = useToast();
  const showFailure = useFailureToast();
  const { channelId } = useActiveChannel();
  const history = useInfiniteQuery({
    ...postHistoryQueryOptions(useApi(), channelId, post.id),
    select: pagedRows,
  });
  const restore = useRestorePostRevision();
  const [conflicting, setConflicting] = useState<string>();

  const items: RevisionListItem[] = (history.data ?? []).map((revision) => ({
    id: revision.id,
    version: revision.version,
    createdAt: revision.createdAt,
    restoredFromVersion: revision.restoredFromVersion,
    changedFields: null,
    note: payloadExcerpt(revision.payload),
    current: revision.version === post.version,
  }));

  const restoreTo = (revisionId: string) =>
    restore.mutate(
      { id: post.id, revisionId, version: post.version },
      {
        onSuccess: () => {
          toast({ tone: 'success', title: tOr('studio.postsHistoryRestored', {}, '') });
          onClose();
        },
        onError: (error) =>
          failureCode(error) === ErrorCodes.VERSION_CONFLICT
            ? setConflicting(revisionId)
            : showFailure(tOr('studio.postsHistoryRestoreFailed', {}, ''), error),
      }
    );

  return (
    <>
      <ResponsiveModal.Root open onOpenChange={(open) => !open && onClose()}>
        <ResponsiveModal.Content size="md">
          <ResponsiveModal.Header>
            <ResponsiveModal.Title>{tOr('studio.postsHistoryTitle', {}, '')}</ResponsiveModal.Title>
            <ResponsiveModal.Description className="line-clamp-2">
              {postExcerpt(post.body)}
            </ResponsiveModal.Description>
          </ResponsiveModal.Header>
          <ResponsiveModal.Body className="flex flex-col gap-stack">
            <p className="m-0 text-fg-muted">{tOr('studio.postsHistoryDescription', {}, '')}</p>
            {history.isPending && <Skeleton className="h-32 w-full" />}
            {history.isError && <p role="alert">{tOr('studio.historyLoadFailed', {}, '')}</p>}
            {history.isSuccess && items.length === 0 && (
              <EmptyState.Root size="section">
                <EmptyState.Title>{tOr('studio.historyEmpty', {}, '')}</EmptyState.Title>
              </EmptyState.Root>
            )}
            {items.length > 0 && (
              <RevisionList
                aria-label={tOr('studio.historyListLabel', {}, '')}
                items={items}
                pending={restore.isPending}
                onRestore={({ id }) => restoreTo(id)}
              />
            )}
            <LoadMore
              hasNextPage={history.hasNextPage}
              fetching={history.isFetchingNextPage}
              onLoadMore={() => void history.fetchNextPage()}
            />
          </ResponsiveModal.Body>
        </ResponsiveModal.Content>
      </ResponsiveModal.Root>
      <VersionConflictDialog
        open={conflicting !== undefined}
        onOpenChange={(open) => !open && setConflicting(undefined)}
        onReload={() => {
          setConflicting(undefined);
          onClose();
        }}
        onOverwrite={() => {
          const revisionId = conflicting;
          setConflicting(undefined);
          if (revisionId) restoreTo(revisionId);
        }}
      />
    </>
  );
}

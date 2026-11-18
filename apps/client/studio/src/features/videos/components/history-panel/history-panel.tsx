import { useT } from '@kit/intl-react';
import { Skeleton, useToast } from '@kit/ui';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type Video } from '@vp/api-contracts';
import { EmptyState } from '@vp/components';
import { diffSnapshots } from '@vp/domain';
import { revisionsQueryOptions, useApi, videoQueryOptions } from '@vp/queries';
import { useState } from 'react';
import { VersionConflictDialog } from '#app/components/dialogs/version-conflict-dialog';
import { RevisionList, type RevisionListItem } from '#app/components/history/revision-list';
import { LoadMore } from '#app/components/table/load-more';
import { isVersionConflict } from '#app/features/videos/api/is-version-conflict';
import { restoreRevisionMutationOptions } from '#app/features/videos/api/video-tool-mutations';

/** The saved versions of the metadata, and a way back to any of them under the video's current version. */
export function HistoryPanel({ video }: { video: Video }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { tOr } = useT();
  const history = useInfiniteQuery(revisionsQueryOptions(api, video.id));
  const restore = useMutation(restoreRevisionMutationOptions(api, video.id));
  const [conflicting, setConflicting] = useState<string | null>(null);

  const revisions = history.data?.pages.flatMap((page) => page.items) ?? [];
  const items: RevisionListItem[] = revisions.map((revision, index) => {
    const older = revisions[index + 1];
    return {
      id: revision.id,
      version: revision.version,
      createdAt: revision.createdAt,
      note: revision.note,
      changedFields: older ? diffSnapshots(older.snapshot, revision.snapshot) : null,
      current: revision.version === video.version,
    };
  });

  const restoreTo = (revisionId: string, version: number) =>
    restore.mutate(
      { revisionId, version },
      {
        onSuccess: () => toast({ tone: 'success', title: tOr('studio.historyRestored', {}, '') }),
        onError: (error) => {
          if (isVersionConflict(error)) {
            setConflicting(revisionId);
            return;
          }
          toast({ tone: 'danger', title: tOr('studio.historyRestoreFailed', {}, '') });
        },
      }
    );

  const latest = () => queryClient.query({ ...videoQueryOptions(api, video.id), staleTime: 0 });

  const reload = async () => {
    await latest();
    setConflicting(null);
  };

  const overwrite = async () => {
    const revisionId = conflicting;
    const { version } = await latest();
    setConflicting(null);
    if (revisionId) restoreTo(revisionId, version);
  };

  return (
    <section className="flex flex-col gap-stack" aria-labelledby="history-title">
      <header className="flex flex-col gap-inline">
        <h2 id="history-title">{tOr('studio.historyTitle', {}, '')}</h2>
        <p className="text-fg-muted">{tOr('studio.historyDescription', {}, '')}</p>
      </header>
      {history.isPending && <Skeleton className="h-40 w-full" />}
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
          onRestore={({ id }) => restoreTo(id, video.version)}
        />
      )}
      <LoadMore
        hasNextPage={history.hasNextPage}
        fetching={history.isFetchingNextPage}
        onLoadMore={() => void history.fetchNextPage()}
      />
      <VersionConflictDialog
        open={conflicting !== null}
        onOpenChange={(open) => !open && setConflicting(null)}
        onReload={reload}
        onOverwrite={overwrite}
      />
    </section>
  );
}

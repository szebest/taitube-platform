import { SectionError } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Button, Drawer } from '@kit/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { PlaylistView } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { PagedFooter } from '#app/components/feed/paged-footer';
import { ActivityList, ActivityListSkeleton } from '#app/components/playlist/activity-list';
import { playlistActivityQueryOptions } from '#app/features/library/api/playlist-queries';
import type { PlaylistAbilities } from '#app/features/library/hooks/use-playlist-abilities';
import { useRestoreActivity } from '#app/features/library/hooks/use-restore-activity';
import { activitySentence } from '#app/features/library/utils/activity-sentence';
import { useT } from '#app/lib/messages';
import { urlModals } from '#app/lib/url-modal/registry';

export interface ActivityDrawerProps {
  playlist: PlaylistView;
  abilities: PlaylistAbilities;
}

function ActivityEntries({ playlist, abilities }: ActivityDrawerProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const activity = useInfiniteQuery(playlistActivityQueryOptions(useApi(), playlist.id));
  const restore = useRestoreActivity(playlist.id);

  const entries = activity.data?.pages.flatMap(({ items }) => items) ?? [];

  if (activity.isPending) {
    return <ActivityListSkeleton />;
  }
  if (activity.isError && entries.length === 0) {
    return (
      <SectionError.Root
        role="alert"
        retrying={activity.isFetching}
        onRetry={() => void activity.refetch()}
      >
        <SectionError.Message>
          {tOr('playlistPeople.activityLoadFailed', {}, '')}
        </SectionError.Message>
      </SectionError.Root>
    );
  }
  if (entries.length === 0) {
    return (
      <p className="m-0 text-body-sm text-fg-muted">
        {tOr('playlistPeople.activityEmpty', {}, '')}
      </p>
    );
  }

  return (
    <>
      <ActivityList.Root aria-label={tOr('playlistPeople.activityLabel', {}, '')}>
        {entries.map((entry) => {
          const sentence = activitySentence(entry, playlist.items, tOr);
          const name = entry.actor?.displayName ?? tOr('playlistPeople.someone', {}, '');
          const restorable = entry.action === 'item_removed' || entry.action === 'auto_removed';
          return (
            <ActivityList.Item key={entry.id}>
              <ActivityList.Avatar src={entry.actor?.avatarUrl ?? undefined} name={name} />
              <ActivityList.Text>{sentence}</ActivityList.Text>
              <ActivityList.Time dateTime={entry.createdAt}>
                {unwrapOr(format({ type: 'relative', value: entry.createdAt }), '')}
              </ActivityList.Time>
              {restorable && abilities.restore && (
                <ActivityList.Action>
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={tOr('playlistPeople.restoreFor', { title: sentence }, '')}
                    loading={restore.isPending && restore.variables === entry.id}
                    onClick={() => restore.mutate(entry.id)}
                  >
                    {tOr('playlistPeople.restore', {}, '')}
                  </Button>
                </ActivityList.Action>
              )}
            </ActivityList.Item>
          );
        })}
      </ActivityList.Root>
      <PagedFooter
        hasMore={activity.hasNextPage}
        isFetching={activity.isFetchingNextPage}
        isError={activity.isFetchNextPageError}
        onLoadMore={() => void activity.fetchNextPage({ cancelRefetch: false })}
      />
    </>
  );
}

/** `?modal=playlist-activity`: every change to the playlist, newest first; the owner restores a removal. */
export function ActivityDrawer({ playlist, abilities }: ActivityDrawerProps) {
  const { tOr } = useT();
  const { isOpen, close } = urlModals.useUrlModal('playlist-activity');

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <Drawer.Content size="lg">
        <Drawer.Handle />
        <Drawer.Header>
          <Drawer.Title>{tOr('playlistPeople.activityTitle', {}, '')}</Drawer.Title>
          <Drawer.Description>
            {tOr('playlistPeople.activityDescription', {}, '')}
          </Drawer.Description>
        </Drawer.Header>
        <Drawer.Body>
          {isOpen && <ActivityEntries playlist={playlist} abilities={abilities} />}
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}

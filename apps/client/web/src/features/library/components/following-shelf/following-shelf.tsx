import {
  EmptyLibraryIllustration,
  EmptyState,
  SectionError,
  Shelf,
  ShelfSkeleton,
} from '@kit/components';
import { Button } from '@kit/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { FollowedPlaylistView } from '@vp/api-contracts';
import { useApi } from '@vp/queries';
import { PlaylistCover } from '#app/components/playlist/playlist-cover';
import { followedPlaylistsQueryOptions } from '#app/features/library/api/playlist-queries';
import { useUnfollowPlaylist } from '#app/features/library/hooks/use-unfollow-playlist';
import { useT } from '#app/lib/messages';

function FollowedCard({ playlistId, playlist }: FollowedPlaylistView) {
  const { tOr } = useT();
  const unfollow = useUnfollowPlaylist();

  if (playlist === null) {
    return (
      <article className="flex w-full flex-col gap-inline">
        <PlaylistCover images={[]} />
        <p className="m-0 text-title text-fg-muted">{tOr('playlistEdit.unavailable', {}, '')}</p>
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          loading={unfollow.isPending}
          onClick={() => unfollow.mutate(playlistId)}
        >
          {tOr('playlistEdit.unfollow', {}, '')}
        </Button>
      </article>
    );
  }

  return (
    <article className="flex w-full flex-col gap-inline">
      <PlaylistCover images={playlist.thumbnailUrl === null ? [] : [playlist.thumbnailUrl]} />
      <Link to="/playlist" search={{ list: playlistId }} className="text-title text-fg focus-ring">
        {playlist.title}
      </Link>
      <p className="m-0 text-caption text-fg-muted">
        {playlist.owner &&
          `${tOr('library.playlistOwner', { name: playlist.owner.displayName }, '')} · `}
        {tOr('library.playlistCount', { count: playlist.videoCount }, '')}
      </p>
    </article>
  );
}

/** The playlists the viewer follows, newest follow first; one that turned private says so and can be dropped. */
export function FollowingShelf() {
  const api = useApi();
  const { tOr } = useT();
  const { data, isPending, isError, isFetching, refetch } = useInfiniteQuery(
    followedPlaylistsQueryOptions(api)
  );

  if (isPending) return <ShelfSkeleton />;

  const followed = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Shelf.Root>
      <Shelf.Header>
        <Shelf.Title asChild>
          <h2>{tOr('playlistEdit.followingTitle', {}, '')}</h2>
        </Shelf.Title>
      </Shelf.Header>
      {isError && followed.length === 0 && (
        <SectionError.Root role="alert" retrying={isFetching} onRetry={() => void refetch()}>
          <SectionError.Message>{tOr('feed.loadMoreFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {!isError && followed.length === 0 && (
        <EmptyState.Root size="inline" role="status">
          <EmptyState.Illustration>
            <EmptyLibraryIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>{tOr('playlistEdit.followingEmpty', {}, '')}</EmptyState.Title>
        </EmptyState.Root>
      )}
      {followed.length > 0 && (
        <Shelf.Track>
          {followed.map((entry) => (
            <Shelf.Item key={entry.playlistId}>
              <FollowedCard {...entry} />
            </Shelf.Item>
          ))}
        </Shelf.Track>
      )}
    </Shelf.Root>
  );
}

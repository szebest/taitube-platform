import { EmptyLibraryIllustration, EmptyState, SectionError } from '@kit/components';
import { assertNever } from '@kit/result';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useApi } from '@vp/queries';
import { FeedSentinel } from '#app/components/feed/feed-sentinel';
import { PlaylistCover } from '#app/components/playlist/playlist-cover';
import { VideoGrid } from '#app/components/video/video-grid';
import { useVideoPages } from '#app/hooks/use-video-pages';
import { useT } from '#app/lib/messages';
import {
  channelPlaylistsQueryOptions,
  channelVideosQueryOptions,
} from '#app/lib/query-keys/channel-page-keys';

type FixedKind = 'videos' | 'shorts' | 'playlists';

function EmptyTab() {
  const { tOr } = useT();

  return (
    <EmptyState.Root size="section">
      <EmptyState.Illustration>
        <EmptyLibraryIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title>{tOr('channelPage.empty', {}, '')}</EmptyState.Title>
    </EmptyState.Root>
  );
}

function ChannelVideosTab({
  channelId,
  format,
}: {
  channelId: string;
  format: 'standard' | 'short';
}) {
  const { tOr } = useT();
  const { videos, hasMore, isFetching, isError, loadMore } = useVideoPages(
    channelVideosQueryOptions(useApi(), channelId, format)
  );

  return (
    <div className="flex flex-col gap-stack">
      {videos.length === 0 ? <EmptyTab /> : <VideoGrid videos={videos} />}
      {isError && (
        <SectionError.Root role="alert" retrying={isFetching} onRetry={loadMore}>
          <SectionError.Message>{tOr('feed.loadMoreFailed', {}, '')}</SectionError.Message>
        </SectionError.Root>
      )}
      {hasMore && !isFetching && !isError && <FeedSentinel onNear={loadMore} />}
    </div>
  );
}

function ChannelPlaylistsTab({ channelId }: { channelId: string }) {
  const { tOr } = useT();
  const { data } = useQuery(channelPlaylistsQueryOptions(useApi(), channelId));

  if (data === undefined || data.items.length === 0) return <EmptyTab />;

  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-stack p-0 medium:grid-cols-2 expanded:grid-cols-4">
      {data.items.map((playlist) => (
        <li key={playlist.id} className="relative flex flex-col gap-inline">
          <PlaylistCover images={playlist.thumbnailUrls} />
          <Link
            to="/playlist"
            search={{ list: playlist.id }}
            className="text-label text-fg no-underline after:absolute after:inset-0 after:content-[''] focus-ring"
          >
            {playlist.title}
          </Link>
          <p className="m-0 text-caption text-fg-muted">
            {tOr('channelPage.playlistVideos', { count: playlist.videoCount }, '')}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** The fixed body of a built-in tab that lists the channel's own content: its videos, its Shorts or its playlists. */
export function ChannelFixedTab({ kind, channelId }: { kind: FixedKind; channelId: string }) {
  switch (kind) {
    case 'videos':
      return <ChannelVideosTab channelId={channelId} format="standard" />;
    case 'shorts':
      return <ChannelVideosTab channelId={channelId} format="short" />;
    case 'playlists':
      return <ChannelPlaylistsTab channelId={channelId} />;
    default:
      return assertNever(kind, 'FixedTabKind');
  }
}

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { EmptyLibraryIllustration, EmptyState, SectionError } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { usePlayerTheater } from '#app/components/player/taitube-player';
import { Queue } from '#app/components/watch/queue';
import { usePlaybackPreference } from '#app/features/account/components/device-preferences-provider/device-preferences-provider';
import { relatedQueryOptions } from '#app/features/watch/api/related-queries';
import { useAutoplayNext } from '#app/features/watch/hooks/use-autoplay-next';
import { usePlaybackQueue } from '#app/features/watch/hooks/use-playback-queue';
import { useQueueNavigation } from '#app/features/watch/hooks/use-queue-navigation';
import { QueueVideoRow } from '../queue-video-row/queue-video-row';

/** The viewer's queue with its modes and "More like this" below it; the queue is a playlist's when the page was opened from one. */
export function WatchQueue() {
  const { videoId } = useParams({ from: '/watch/$videoId' });
  const api = useApi();
  const { tOr } = useT();
  const [autoplayNext, setAutoplayNext] = usePlaybackPreference('autoplayNext');
  const {
    data: related,
    isPending: relatedPending,
    isError: relatedFailed,
    isFetching: relatedFetching,
    refetch: refetchRelated,
  } = useQuery(relatedQueryOptions(api, videoId));
  const { videos, playlistId, shuffle, repeat, reorder, remove, setModes } = usePlaybackQueue();
  const { open } = useQueueNavigation();
  const theater = usePlayerTheater();

  const position = videos.findIndex(({ id }) => id === videoId) + 1;
  const recommended = related?.items.filter(({ id }) => id !== videoId) ?? [];

  useAutoplayNext(recommended);

  const select = (id: string) => {
    const picked = videos.find((video) => video.id === id);
    if (picked && id !== videoId) {
      open(picked, { replace: false });
    }
  };

  return (
    <Queue.Root
      currentId={videoId}
      layout={theater ? 'below' : undefined}
      collapsible
      onReorder={reorder}
      onRemove={remove}
      onSelect={select}
    >
      <Queue.Header
        position={
          position > 0
            ? tOr('watch.queuePosition', { position, count: videos.length }, '')
            : undefined
        }
        modes={
          <Queue.Modes
            shuffle={shuffle}
            repeat={repeat}
            autoplay={autoplayNext}
            onChange={(next) => {
              setModes(next);
              if (next.autoplay !== autoplayNext) {
                setAutoplayNext(next.autoplay);
              }
            }}
          />
        }
      >
        {tOr('watch.queueTitle', {}, '')}
      </Queue.Header>
      {videos.length > 0 ? (
        <Queue.List items={videos.map(({ id }) => id)}>
          {videos.map((queued, index) => (
            <Queue.Item
              key={queued.id}
              id={queued.id}
              title={queued.title ?? tOr('browse.untitled', {}, '')}
            >
              <QueueVideoRow
                video={queued}
                current={queued.id === videoId}
                playlist={playlistId ? { id: playlistId, index } : undefined}
              />
            </Queue.Item>
          ))}
        </Queue.List>
      ) : (
        <EmptyState.Root size="inline">
          <EmptyState.Illustration>
            <EmptyLibraryIllustration />
          </EmptyState.Illustration>
          <EmptyState.Title>{tOr('watch.queueEmpty', {}, '')}</EmptyState.Title>
          <EmptyState.Action asChild>
            <Link to="/">{tOr('watch.queueBrowse', {}, '')}</Link>
          </EmptyState.Action>
        </EmptyState.Root>
      )}
      {(relatedPending || relatedFailed || recommended.length > 0) && (
        <Queue.Recommendations
          heading={tOr('videos.moreLikeThis', {}, '')}
          loading={relatedPending}
        >
          {relatedFailed && recommended.length === 0 ? (
            <SectionError.Root
              role="alert"
              layout="block"
              retrying={relatedFetching}
              onRetry={refetchRelated}
            >
              <SectionError.Message>{tOr('watch.relatedFailed', {}, '')}</SectionError.Message>
            </SectionError.Root>
          ) : (
            recommended.map(({ reason, ...item }) => (
              <QueueVideoRow key={item.id} video={item} reason={reason} />
            ))
          )}
        </Queue.Recommendations>
      )}
    </Queue.Root>
  );
}

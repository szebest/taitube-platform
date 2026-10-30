import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import type { Video, VideoSummary } from '@vp/api-contracts';
import { EmptyLibraryIllustration, EmptyState } from '@vp/components';
import { useT } from '@vp/intl-react';
import { useApi, videoQueryOptions } from '@vp/queries';
import { useMediaQuery } from '@vp/ui';

import { Queue } from '#app/components/watch/queue';
import { usePlayerTheater } from '#app/features/player';

import { relatedQueryOptions } from '../api/related-queries';
import { usePlaybackQueue } from '../hooks/use-playback-queue';
import { QueueVideoRow } from './queue-video-row';

const COMPACT = '(max-width: 599px)';

function toSummary(video: Video): VideoSummary {
  return { ...video, channel: video.channel ?? null };
}

/** The viewer's queue, which holds the video on the stage alone for now, and "More like this" below it. */
export function WatchQueue() {
  const { videoId } = useParams({ from: '/watch/$videoId' });
  const api = useApi();
  const navigate = useNavigate();
  const { tOr } = useT();
  const { data: video } = useSuspenseQuery(videoQueryOptions(api, videoId));
  const { data: related, isPending: relatedPending } = useQuery(relatedQueryOptions(api, videoId));
  const { videos, reorder, remove } = usePlaybackQueue([toSummary(video)]);
  const theater = usePlayerTheater();
  const compact = useMediaQuery(COMPACT);

  const layout = compact ? 'sheet' : theater ? 'below' : undefined;
  const position = videos.findIndex(({ id }) => id === videoId) + 1;
  const recommended = related?.items.filter(({ id }) => id !== videoId) ?? [];

  const select = (id: string) => {
    if (id === videoId) {
      return;
    }

    navigate({ to: '/watch/$videoId', params: { videoId: id } });
  };

  return (
    <Queue.Root
      currentId={videoId}
      layout={layout}
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
      >
        {tOr('watch.queueTitle', {}, '')}
      </Queue.Header>
      {videos.length > 0 ? (
        <Queue.List items={videos.map(({ id }) => id)}>
          {videos.map((queued) => (
            <Queue.Item
              key={queued.id}
              id={queued.id}
              title={queued.title ?? tOr('browse.untitled', {}, '')}
            >
              <QueueVideoRow video={queued} current={queued.id === videoId} />
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
      {(relatedPending || recommended.length > 0) && (
        <Queue.Recommendations heading={tOr('videos.moreLikeThis', {}, '')} loading={relatedPending}>
          {recommended.map(({ reason, ...item }) => (
            <QueueVideoRow key={item.id} video={item} reason={reason} />
          ))}
        </Queue.Recommendations>
      )}
    </Queue.Root>
  );
}

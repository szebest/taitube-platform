import { useQuery } from '@tanstack/react-query';
import { useApi, usePostViewer, videoThreadsQueryOptions } from '@vp/queries';
import {
  TimelineMarkerLayer,
  type TimelineMarker,
} from '#app/components/player/timeline-marker-layer';
import { useThreadSearch } from '#app/features/watch/hooks/use-thread-search';

export interface WatchThreadMarkersProps {
  videoId: string;
}

/** The seek bar's thread markers for a video: the server's markers, each named by the thread it opens. */
export function WatchThreadMarkers({ videoId }: WatchThreadMarkersProps) {
  const api = useApi();
  const { open } = useThreadSearch(videoId);
  const { data } = useQuery(videoThreadsQueryOptions(api, videoId, usePostViewer()));
  if (!data) return null;

  const threadsById = new Map(data.items.map((thread) => [thread.id, thread]));
  const markers = data.markers.flatMap(({ threadId, anchorMs, count }): TimelineMarker[] => {
    const thread = threadsById.get(threadId);
    return thread
      ? [{ id: threadId, atMs: anchorMs, title: thread.title, replies: thread.replyCount, count }]
      : [];
  });

  return <TimelineMarkerLayer markers={markers} onActivate={open} />;
}

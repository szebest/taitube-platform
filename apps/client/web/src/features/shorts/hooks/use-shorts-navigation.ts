import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useApi, videoQueryOptions } from '@vp/queries';
import { useVideoPages } from '#app/hooks/use-video-pages';
import { shortsFeedQueryOptions } from '#app/lib/query-keys/feed-keys';

/**
 * The Shorts of the feed and the one the URL names. A Short opened by link that the feed has not served is
 * put first. Where the viewer is after that belongs to the feed's own scroll, not to the URL.
 */
export function useShortsNavigation() {
  const named = useParams({ strict: false, select: ({ videoId }) => videoId });
  const api = useApi();
  const { videos, hasMore, loadMore } = useVideoPages(shortsFeedQueryOptions(api));
  const { data: linked } = useQuery({
    ...videoQueryOptions(api, named ?? ''),
    enabled: named !== undefined,
  });

  const served = videos.some(({ id }) => id === named);
  const shorts =
    linked && !served ? [{ ...linked, channel: linked.channel ?? null }, ...videos] : videos;

  return { shorts, named, hasMore, loadMore };
}

import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useApi, videoQueryOptions } from '@vp/queries';

import { shortsFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { useVideoPages } from '#app/hooks/use-video-pages';

const PRELOAD_AHEAD = 2;
const LOAD_MORE_WITHIN = 3;

/**
 * Where the viewer is in the Shorts feed. The URL names the current Short; moving replaces it, so Back
 * leaves the player. A Short opened by link that the feed has not served is put first.
 */
export function useShortsNavigation() {
  const videoId = useParams({ strict: false, select: ({ videoId }) => videoId });
  const navigate = useNavigate();
  const api = useApi();
  const { videos, hasMore, loadMore } = useVideoPages(shortsFeedQueryOptions(api));
  const { data: linked } = useQuery({
    ...videoQueryOptions(api, videoId ?? ''),
    enabled: videoId !== undefined,
  });

  const served = videos.some(({ id }) => id === videoId);
  const shorts =
    linked && !served ? [{ ...linked, channel: linked.channel ?? null }, ...videos] : videos;
  const found = shorts.findIndex(({ id }) => id === videoId);
  const index = Math.max(found, 0);
  const current = shorts[index];

  const goTo = (target: number) => {
    const short = shorts[target];
    if (!short) {
      return;
    }

    if (hasMore && target >= shorts.length - LOAD_MORE_WITHIN) {
      loadMore();
    }
    navigate({ to: '/shorts/$videoId', params: { videoId: short.id }, replace: true });
  };

  return {
    current,
    upcoming: shorts.slice(index + 1, index + 1 + PRELOAD_AHEAD),
    previous: index > 0 ? () => goTo(index - 1) : undefined,
    next: index < shorts.length - 1 ? () => goTo(index + 1) : undefined,
    ended: !hasMore && index === shorts.length - 1,
  };
}

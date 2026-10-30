import { useApi } from '@vp/queries';

import { shortsFeedQueryOptions } from '#app/features/feed/api/feed-queries';
import { useVideoPages } from '#app/hooks/use-video-pages';

/** The Shorts the platform serves, page after page, never one twice. */
export function useShortsFeed() {
  const api = useApi();

  return useVideoPages(shortsFeedQueryOptions(api));
}

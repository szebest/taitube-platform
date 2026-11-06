import type { ApiClient } from '@vp/api-client';
import type { VideoSummary } from '@vp/api-contracts';

/** The API's page ceiling: a deployment with a lower one answers shorter pages and the cursor walks on. */
const PAGE_SIZE = 100;

/** The newest public READY videos the feed serves, at most `limit`. */
export async function listPublicVideos(api: ApiClient, limit: number): Promise<VideoSummary[]> {
  const videos: VideoSummary[] = [];
  let cursor: string | undefined;

  while (videos.length < limit) {
    const page = await api.feed.getFeed({
      query: { sort: 'recent', limit: Math.min(PAGE_SIZE, limit - videos.length), cursor },
    });
    videos.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return videos;
}

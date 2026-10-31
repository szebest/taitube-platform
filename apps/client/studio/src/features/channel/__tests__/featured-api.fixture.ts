import {
  type ChannelFeaturedView,
  getChannelFeatured,
  listCreatorVideos,
  setChannelFeatured,
  type VideoSummary,
} from '@vp/api-contracts';
import type { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply } from '@vp/web-testing';
import { HttpResponse } from 'msw/http';

import { creatorVideo, videoIdOf } from '#app/features/content/__tests__/creator-video.fixture';

/** `count` public, ready videos of the creator, titled `Video 1`, `Video 2`, and so on. */
export const libraryOf = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    creatorVideo({ id: videoIdOf(index), title: `Video ${index + 1}` })
  );

const pinnedView = (videos: readonly VideoSummary[]): ChannelFeaturedView => ({
  source: videos.length === 0 ? 'popular' : 'pinned',
  items: [...videos],
});

interface FeaturedApiOptions {
  /** The videos the picker lists, newest first, `limit` a page. */
  library?: readonly VideoSummary[];
  pinned?: readonly VideoSummary[];
  /** What a save answers with, instead of accepting it. */
  refuses?: (typeof ErrorCodes)[keyof typeof ErrorCodes];
  pageSize?: number;
}

/**
 * The channel's shelf and the creator's library: a save replaces the pins as the API does and
 * every body it received comes back for assertions.
 */
export function featuredApi({
  library = [],
  pinned = [],
  refuses,
  pageSize = 30,
}: FeaturedApiOptions = {}) {
  const saved: string[][] = [];
  let shelf = pinnedView(pinned);

  const handlers = [
    mockEndpoint(getChannelFeatured, () => HttpResponse.json(shelf)),
    mockEndpoint(setChannelFeatured, async ({ request }) => {
      const { videoIds } = await request.json();
      saved.push(videoIds);
      if (refuses !== undefined) {
        return problemReply(refuses);
      }
      shelf = pinnedView(videoIds.flatMap((id) => library.find((video) => video.id === id) ?? []));
      return HttpResponse.json(shelf);
    }),
    mockEndpoint(listCreatorVideos, ({ request }) => {
      const { searchParams } = new URL(request.url);
      const from = Number(searchParams.get('cursor') ?? 0);
      const next = from + pageSize;
      return HttpResponse.json({
        items: library.slice(from, next).map((video) => creatorVideo(video)),
        nextCursor: next < library.length ? String(next) : null,
      });
    }),
  ];

  return { handlers, saved };
}

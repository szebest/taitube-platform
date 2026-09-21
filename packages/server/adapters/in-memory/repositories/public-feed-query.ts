import {
  comparePublicFeedRank,
  isAfterPublicFeedCursor,
  isPublicFeedEligible,
  publicFeedInstant,
  publicFeedRanking,
} from '@vp/core/domain';
import type { ListPublicVideosOptions, ListPublicVideosResult, VideoRecord } from '@vp/core/ports';

interface RankedVideo {
  rank: number;
  id: string;
  video: VideoRecord;
}

export function selectPublicFeed(
  videos: Iterable<VideoRecord>,
  options: ListPublicVideosOptions
): ListPublicVideosResult {
  const { cursor, limit } = options;
  const ranking = publicFeedRanking(options.sort);
  const nowMs = publicFeedInstant();

  const eligible: RankedVideo[] = [];
  for (const video of videos) {
    if (!isPublicFeedEligible(video, options.categoryId)) continue;
    eligible.push({ rank: ranking.rankOf(video, nowMs), id: video.id, video });
  }
  eligible.sort(comparePublicFeedRank);

  const cursorRank = cursor ? ranking.cursorRankOf(cursor) : undefined;
  const page =
    cursor && cursorRank !== undefined
      ? eligible.filter((entry) =>
          isAfterPublicFeedCursor(entry, { rank: cursorRank, id: cursor.id })
        )
      : eligible;

  return {
    items: page.slice(0, limit + 1).map((entry) => entry.video),
    total: eligible.length,
  };
}

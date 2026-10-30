import type {
  ListPublicVideosOptions,
  ListPublicVideosResult,
  VideoRecord,
} from '@vp/core/repositories';
import {
  comparePublicFeedRank,
  isAfterPublicFeedCursor,
  isPublicFeedEligible,
  isUnseenByPublicFeedCursor,
  publicFeedRanking,
  publicFeedWalkInstant,
} from '@vp/domain';

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
  const rankOf = publicFeedRanking(options.sort);
  const nowMs = publicFeedWalkInstant(cursor);

  const eligible: RankedVideo[] = [];
  for (const video of videos) {
    if (!isPublicFeedEligible(video, options)) continue;
    eligible.push({ rank: rankOf(video, nowMs), id: video.id, video });
  }
  eligible.sort(comparePublicFeedRank);

  const bound = cursor ? { rank: rankOf(cursor, nowMs), id: cursor.id } : undefined;
  const page = bound
    ? eligible.filter(
        (entry) =>
          isAfterPublicFeedCursor(entry, bound) && isUnseenByPublicFeedCursor(entry, cursor)
      )
    : eligible;

  return {
    items: page.slice(0, limit + 1).map((entry) => entry.video),
    total: eligible.length,
    instant: nowMs,
  };
}

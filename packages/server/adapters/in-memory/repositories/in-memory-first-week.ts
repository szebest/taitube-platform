import { MS_PER_DAY } from '@kit/primitives';
import type { VideoRecord } from '@vp/core/repositories';
import {
  FIRST_WEEK_DAYS,
  type FirstWeekRow,
  PUBLIC_FEED_STATUS,
  PUBLIC_FEED_VISIBILITY,
  type PeerVideo,
  type ViewCount,
  viewDateOf,
} from '@vp/domain';

export function firstWeekRowsOf(
  videos: readonly VideoRecord[],
  daily: readonly ViewCount[]
): FirstWeekRow[] {
  return videos.flatMap((video) => {
    if (!video.readyAt) return [];
    const readyDay = Date.parse(viewDateOf(video.readyAt));
    const perDay = new Map<number, number>();
    for (const count of daily) {
      const dayOffset = (Date.parse(count.viewDate) - readyDay) / MS_PER_DAY;
      if (count.videoId !== video.id || dayOffset < 0 || dayOffset >= FIRST_WEEK_DAYS) continue;
      perDay.set(dayOffset, (perDay.get(dayOffset) ?? 0) + count.views);
    }
    return [...perDay].map(([dayOffset, views]) => ({ videoId: video.id, dayOffset, views }));
  });
}

export function recentPeersOf(
  videos: readonly VideoRecord[],
  channelId: string,
  excludeVideoId: string,
  readyBefore: Date
): PeerVideo[] {
  return videos
    .flatMap((video) =>
      video.channelId === channelId &&
      video.id !== excludeVideoId &&
      video.visibility === PUBLIC_FEED_VISIBILITY &&
      video.status === PUBLIC_FEED_STATUS &&
      video.readyAt &&
      video.readyAt <= readyBefore
        ? [{ videoId: video.id, readyAt: video.readyAt }]
        : []
    )
    .sort(
      (left, right) =>
        right.readyAt.getTime() - left.readyAt.getTime() ||
        right.videoId.localeCompare(left.videoId)
    );
}

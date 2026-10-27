import { type WatchHistoryEntry, isWatchCompleted, watchedPercent } from './watch-history';

export const HOME_SHELVES = {
  shelfSize: 12,
  historyWindow: 40,
  becauseWatchedShelves: 3,
  categoryShelves: 2,
  strongWatchPercent: 50,
  cacheTtlSeconds: 300,
} as const;

export function isContinuable(entry: WatchHistoryEntry): boolean {
  return entry.video.status === 'READY' && entry.progressSeconds > 0 && !isWatchCompleted(entry);
}

export function isStrongWatch(entry: WatchHistoryEntry): boolean {
  return entry.video.status === 'READY' && watchedPercent(entry) >= HOME_SHELVES.strongWatchPercent;
}

/** Most frequent first; a tie goes to the category seen first. */
export function topCategoryIds(
  videos: readonly { categoryId?: string | null }[],
  max: number
): string[] {
  const counts = new Map<string, number>();
  for (const { categoryId } of videos) {
    if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, max)
    .map(([categoryId]) => categoryId);
}

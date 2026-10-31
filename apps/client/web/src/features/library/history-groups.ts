import type { WatchHistoryItemView } from '@vp/api-contracts';

type HistoryGroupId = 'today' | 'yesterday' | 'thisWeek' | 'older';

export interface HistoryGroup {
  id: HistoryGroupId;
  items: WatchHistoryItemView[];
}

const MS_PER_DAY = 86_400_000;
const WEEK_DAYS = 7;

const GROUP_ORDER: HistoryGroupId[] = ['today', 'yesterday', 'thisWeek', 'older'];

function utcDay(iso: string): number {
  return Math.floor(Date.parse(iso) / MS_PER_DAY);
}

function groupOf(watchedAt: string, now: string | undefined): HistoryGroupId {
  if (now === undefined) return 'older';
  const daysAgo = utcDay(now) - utcDay(watchedAt);
  if (daysAgo <= 0) return 'today';
  if (daysAgo === 1) return 'yesterday';
  if (daysAgo < WEEK_DAYS) return 'thisWeek';
  return 'older';
}

/**
 * Buckets by UTC calendar day, the zone the app renders in, newest group first; an empty group is
 * left out, and with no reference instant everything is older.
 */
export function groupByDay(items: WatchHistoryItemView[], now: string | undefined): HistoryGroup[] {
  const groups = GROUP_ORDER.map((id) => ({
    id,
    items: items.filter((item) => groupOf(item.watchedAt, now) === id),
  }));

  return groups.filter((group) => group.items.length > 0);
}

/** The items whose title holds the words, ignoring case; no words keeps them all. */
export function filterByTitle(
  items: WatchHistoryItemView[],
  words: string
): WatchHistoryItemView[] {
  const needle = words.trim().toLowerCase();
  if (needle === '') return items;

  return items.filter(({ video }) => (video.title ?? '').toLowerCase().includes(needle));
}

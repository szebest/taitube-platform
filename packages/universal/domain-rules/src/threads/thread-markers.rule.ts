import {
  THREAD_MARKERS_DRAWN,
  THREAD_MARKER_MERGE_PERCENT,
  THREAD_MARKER_MIN_REPLIERS,
  THREAD_MARKER_MIN_REPLIES,
} from '@vp/domain';

export interface MarkerThread {
  readonly id: string;
  readonly anchorMs: number;
  readonly pinned: boolean;
  readonly replyCount: number;
  readonly repliers: number;
}

export interface ThreadMarker {
  /** Where the marker sits: the earliest anchor of the threads it holds. */
  readonly anchorMs: number;
  /** The thread a click opens: the first pinned one, else the one with the most replies. */
  readonly threadId: string;
  readonly threadIds: string[];
  readonly count: number;
}

const earnsMarker = (thread: MarkerThread): boolean =>
  thread.pinned ||
  (thread.replyCount >= THREAD_MARKER_MIN_REPLIES && thread.repliers >= THREAD_MARKER_MIN_REPLIERS);

const byAnchor = (left: MarkerThread, right: MarkerThread): number =>
  left.anchorMs - right.anchorMs || left.id.localeCompare(right.id);

interface Group {
  readonly anchorMs: number;
  readonly threads: MarkerThread[];
}

function lead({ threads }: Group): MarkerThread {
  const pinned = threads.find((thread) => thread.pinned);
  if (pinned) return pinned;
  return threads.reduce((best, thread) => (thread.replyCount > best.replyCount ? thread : best));
}

const hasPin = ({ threads }: Group): boolean => threads.some((thread) => thread.pinned);

const weight = ({ threads }: Group): number =>
  threads.reduce((sum, thread) => sum + thread.replyCount, 0);

/**
 * The seek bar markers of a video: threads that earned one, those within a share of the duration
 * of the first of a group merged into it, and at most `THREAD_MARKERS_DRAWN` of them, keeping the
 * groups with pins and then the busiest.
 */
export function placeThreadMarkers(
  threads: readonly MarkerThread[],
  durationMs: number
): ThreadMarker[] {
  if (durationMs <= 0) return [];
  const reach = (durationMs * THREAD_MARKER_MERGE_PERCENT) / 100;

  const groups: Group[] = [];
  for (const thread of threads.filter(earnsMarker).sort(byAnchor)) {
    const group = groups.at(-1);
    if (group && thread.anchorMs - group.anchorMs <= reach) group.threads.push(thread);
    else groups.push({ anchorMs: thread.anchorMs, threads: [thread] });
  }

  return groups
    .sort(
      (a, b) =>
        Number(hasPin(b)) - Number(hasPin(a)) || weight(b) - weight(a) || a.anchorMs - b.anchorMs
    )
    .slice(0, THREAD_MARKERS_DRAWN)
    .sort((a, b) => a.anchorMs - b.anchorMs)
    .map((group) => ({
      anchorMs: group.anchorMs,
      threadId: lead(group).id,
      threadIds: group.threads.map((thread) => thread.id),
      count: group.threads.length,
    }));
}

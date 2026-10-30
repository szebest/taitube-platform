import type { ChannelCard } from './channel';
import type { Video } from './video';

export const RECOMMENDATION_FEEDBACK_KINDS = ['not_interested', 'hide_channel'] as const;
export type RecommendationFeedbackKind = (typeof RECOMMENDATION_FEEDBACK_KINDS)[number];

export const RECOMMENDATION_FEEDBACK_LIMIT = 1000;

/** A viewer's own watching and subscribing outrank "don't recommend". */
const EXEMPT_SHELF_KINDS: readonly string[] = ['continue', 'subscriptions'];

export type FeedbackTarget =
  | { kind: 'not_interested'; videoId: string }
  | { kind: 'hide_channel'; channelId: string };

export type RecommendationFeedback = FeedbackTarget & { id: string; createdAt: Date };

export type NewRecommendationFeedback = RecommendationFeedback & { userId: string };

/** What the settings list shows: the video only while the caller may still watch it. */
export type RecommendationFeedbackEntry = RecommendationFeedback & {
  video: Video | null;
  channel: ChannelCard | null;
};

export interface HiddenFeedback {
  videoIds: ReadonlySet<string>;
  channelIds: ReadonlySet<string>;
}

interface Recommendable {
  id: string;
  channel?: { id: string } | null;
}

export function isHidden(item: Recommendable, hidden: HiddenFeedback): boolean {
  return (
    hidden.videoIds.has(item.id) || (item.channel != null && hidden.channelIds.has(item.channel.id))
  );
}

export function withoutHidden<T extends Recommendable>(
  items: readonly T[],
  hidden: HiddenFeedback
): T[] {
  return items.filter((item) => !isHidden(item, hidden));
}

/** A shelf left empty is dropped; a shelf that loses items is not back-filled. */
export function applyFeedback<I extends Recommendable, S extends { kind: string; items: I[] }>(
  shelves: readonly S[],
  hidden: HiddenFeedback
): S[] {
  return shelves.flatMap((shelf) => {
    if (EXEMPT_SHELF_KINDS.includes(shelf.kind)) return [shelf];
    const items = withoutHidden(shelf.items, hidden);
    return items.length > 0 ? [{ ...shelf, items }] : [];
  });
}

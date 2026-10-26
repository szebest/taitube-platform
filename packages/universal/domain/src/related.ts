export const RELATED_LIMIT = 20;

/** What each index-backed source may hand the ranking: bounds the work on a popular video. */
export const RELATED_CANDIDATES = { perSource: 200, perViewer: 20 } as const;

export type RelatedReasonKind = 'co-watched' | 'shared-tags' | 'same-channel' | 'same-category';

export interface RelatedSignals {
  coWatchers: number;
  sharedTags: number;
  sameChannel: boolean;
  sameCategory: boolean;
}

export interface RelatedCandidate {
  id: string;
  viewsCount: number;
  signals: RelatedSignals;
}

/** The strongest signal a video matched on, which is also the reason it is shown. */
export function relatedReasonOf(signals: RelatedSignals): RelatedReasonKind | null {
  if (signals.coWatchers > 0) return 'co-watched';
  if (signals.sharedTags > 0) return 'shared-tags';
  if (signals.sameChannel) return 'same-channel';
  if (signals.sameCategory) return 'same-category';
  return null;
}

export function compareRelated(a: RelatedCandidate, b: RelatedCandidate): number {
  return (
    b.signals.coWatchers - a.signals.coWatchers ||
    b.signals.sharedTags - a.signals.sharedTags ||
    Number(b.signals.sameChannel) - Number(a.signals.sameChannel) ||
    Number(b.signals.sameCategory) - Number(a.signals.sameCategory) ||
    b.viewsCount - a.viewsCount ||
    b.id.localeCompare(a.id)
  );
}

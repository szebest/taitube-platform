import type { PlaylistItemResultView } from '@vp/api-contracts';

type RefusalCode = NonNullable<PlaylistItemResultView['code']> | 'UNKNOWN';

export interface ItemResultsSummary {
  /** Items that went in. */
  landed: number;
  /** Items the target held already, skipped. */
  duplicates: number;
  refused: { itemId: string; code: RefusalCode }[];
}

/** A batch's per-item answers as the counts and the refusals a viewer reads. */
export function summarizeItemResults(
  results: readonly PlaylistItemResultView[]
): ItemResultsSummary {
  return {
    landed: results.filter(({ ok, duplicate }) => ok && !duplicate).length,
    duplicates: results.filter(({ ok, duplicate }) => ok && duplicate).length,
    refused: results
      .filter(({ ok }) => !ok)
      .map(({ itemId, code }) => ({ itemId, code: code ?? 'UNKNOWN' })),
  };
}

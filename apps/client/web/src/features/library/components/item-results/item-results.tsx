import type { PlaylistItemResultView } from '@vp/api-contracts';
import { summarizeItemResults } from '#app/features/library/utils/summarize-item-results';
import { useT } from '#app/lib/messages';

export interface ItemResultsProps {
  mode: 'move' | 'copy' | 'merge';
  results: readonly PlaylistItemResultView[];
  /** The title of an item of the batch, when the page knows it. */
  titleOf: (itemId: string) => string | undefined;
}

/** A batch's answer: how many landed, how many were skipped as duplicates, and each refusal with its reason. */
export function ItemResults({ mode, results, titleOf }: ItemResultsProps) {
  const { tOr } = useT();
  const { landed, duplicates, refused } = summarizeItemResults(results);

  return (
    <div role="status" className="flex flex-col gap-inline">
      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body">
        <li>{tOr('playlistEdit.resultLanded', { mode, count: landed }, '')}</li>
        <li>{tOr('playlistEdit.resultDuplicates', { count: duplicates }, '')}</li>
        <li>{tOr('playlistEdit.resultRefused', { count: refused.length }, '')}</li>
      </ul>
      {refused.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body-sm text-fg-muted">
          {refused.map(({ itemId, code }) => (
            <li key={itemId}>
              {tOr(
                'playlistEdit.refusedItem',
                { title: titleOf(itemId) ?? tOr('browse.untitled', {}, ''), reason: code },
                ''
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

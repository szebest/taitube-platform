import { useInfiniteQuery } from '@tanstack/react-query';
import type { RecommendationFeedbackItemView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Button } from '@vp/ui';
import { useUndoRecommendationFeedback } from '#app/hooks/use-undo-recommendation-feedback';
import { hiddenRecommendationsQueryOptions } from '#app/lib/query-keys/recommendation-feedback-keys';
import { SettingItem } from '../setting-item/setting-item';

function useHiddenName() {
  const { tOr } = useT();

  return (item: RecommendationFeedbackItemView): string => {
    if (item.kind === 'hide_channel') {
      return tOr('settings.hiddenChannel', { name: item.channel?.displayName ?? '' }, '');
    }
    return item.video?.title ?? tOr('settings.hiddenVideoUnavailable', {}, '');
  };
}

/** The videos and channels the viewer told the recommendations to leave out, each with its Undo. */
export function HiddenRecommendationsRow() {
  const api = useApi();
  const { tOr } = useT();
  const nameOf = useHiddenName();
  const { data, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    hiddenRecommendationsQueryOptions(api)
  );
  const { mutate: undo, isPending } = useUndoRecommendationFeedback();
  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SettingItem
      row="hidden-recommendations"
      description={tOr('settings.rowDescription', { row: 'hidden-recommendations' }, '')}
      stacked
    >
      {isError && <p role="alert">{tOr('settings.hiddenFailed', {}, '')}</p>}
      {data && items.length === 0 && <p>{tOr('settings.hiddenEmpty', {}, '')}</p>}
      {items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-stack p-0">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-stack">
              <span>{nameOf(item)}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                aria-label={tOr('settings.hiddenUndoLabel', { name: nameOf(item) }, '')}
                onClick={() => undo(item.id)}
              >
                {tOr('settings.hiddenUndo', {}, '')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {hasNextPage && (
        <Button variant="ghost" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
          {tOr('settings.hiddenLoadMore', {}, '')}
        </Button>
      )}
    </SettingItem>
  );
}

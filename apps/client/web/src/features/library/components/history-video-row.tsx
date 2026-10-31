import type { WatchHistoryItemView } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { DropdownMenu, Icon } from '@vp/ui';

import { useRemoveFromHistory } from '../hooks/use-remove-from-history';
import { LibraryVideoRow } from './library-video-row';

export interface HistoryVideoRowProps {
  item: WatchHistoryItemView;
}

/** A watched video as a `row` card in its partly watched state; it resumes where the viewer stopped. */
export function HistoryVideoRow({ item }: HistoryVideoRowProps) {
  const { tOr } = useT();
  const { mutate } = useRemoveFromHistory(item.videoId);

  return (
    <LibraryVideoRow
      video={item.video}
      at={item.watchedAt}
      progress={item.progressPercent > 0 ? item.progressPercent / 100 : undefined}
      resumeAt={item.resumeAtSeconds > 0 ? item.resumeAtSeconds : undefined}
      actions={
        <DropdownMenu.Item onSelect={() => mutate()}>
          <Icon name="trash" />
          {tOr('library.removeFromHistory', {}, '')}
        </DropdownMenu.Item>
      }
    />
  );
}

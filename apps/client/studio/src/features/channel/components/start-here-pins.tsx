import type { VideoSummary } from '@vp/api-contracts';
import { VideoThumbnail } from '@vp/components';
import { useT } from '@vp/intl-react';
import { Icon, IconButton, SortableList } from '@vp/ui';

interface StartHerePinsProps {
  pins: readonly VideoSummary[];
  onReorder: (order: readonly string[]) => void;
  onRemove: (videoId: string) => void;
}

/** The pinned videos in the order viewers see them, moved by drag or by keyboard. */
export function StartHerePins({ pins, onReorder, onRemove }: StartHerePinsProps) {
  const { tOr } = useT();

  return (
    <SortableList.Root
      items={pins.map(({ id }) => id)}
      onReorder={onReorder}
      aria-label={tOr('studio.startHerePinsLabel', {}, '')}
      className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-inline tw:p-0"
    >
      {pins.map((video, index) => {
        const title = video.title ?? tOr('browse.untitled', {}, '');

        return (
          <SortableList.Item
            key={video.id}
            id={video.id}
            aria-label={title}
            className="tw:flex tw:items-center tw:gap-stack"
          >
            <SortableList.Handle />
            <span className="tw:w-4 tw:text-caption tw:text-fg-muted tw:tabular-nums">
              {index + 1}
            </span>
            <VideoThumbnail.Root className="tw:w-row-thumb tw:shrink-0">
              <VideoThumbnail.Image src={video.thumbnailUrl ?? video.posterUrl} />
            </VideoThumbnail.Root>
            <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-label">{title}</span>
            <IconButton
              size="sm"
              aria-label={tOr('studio.startHereRemove', { title }, '')}
              onClick={() => onRemove(video.id)}
            >
              <Icon name="close" size="sm" />
            </IconButton>
          </SortableList.Item>
        );
      })}
    </SortableList.Root>
  );
}

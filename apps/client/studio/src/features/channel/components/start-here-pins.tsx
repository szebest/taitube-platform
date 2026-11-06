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
      className="m-0 flex list-none flex-col gap-inline p-0"
    >
      {pins.map((video, index) => {
        const title = video.title ?? tOr('browse.untitled', {}, '');

        return (
          <SortableList.Item
            key={video.id}
            id={video.id}
            aria-label={title}
            className="flex items-center gap-stack"
          >
            <SortableList.Handle />
            <span className="w-4 text-caption text-fg-muted tabular-nums">
              {index + 1}
            </span>
            <VideoThumbnail.Root className="w-row-thumb shrink-0">
              <VideoThumbnail.Image src={video.thumbnailUrl ?? video.posterUrl} />
            </VideoThumbnail.Root>
            <span className="min-w-0 flex-1 truncate text-label">{title}</span>
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

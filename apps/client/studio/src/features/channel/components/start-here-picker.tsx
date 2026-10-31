import { useInfiniteQuery } from '@tanstack/react-query';
import type { VideoSummary } from '@vp/api-contracts';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Button, Command, Popover } from '@vp/ui';

import { pickableVideosQueryOptions } from '../api/channel-featured';

interface StartHerePickerProps {
  pinned: readonly VideoSummary[];
  disabled: boolean;
  onPick: (video: VideoSummary) => void;
}

/** "Add videos": the creator's public, ready videos not yet pinned, searched by title. */
export function StartHerePicker({ pinned, disabled, onPick }: StartHerePickerProps) {
  const { tOr } = useT();
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    pickableVideosQueryOptions(useApi())
  );
  const pinnedIds = new Set(pinned.map(({ id }) => id));
  const choices = (data?.pages ?? []).flatMap(({ items }) =>
    items.filter(({ id }) => !pinnedIds.has(id))
  );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" disabled={disabled}>
          {tOr('studio.startHereAdd', {}, '')}
        </Button>
      </Popover.Trigger>
      <Popover.Content align="start" className="tw:p-0">
        <Command.Root aria-label={tOr('studio.startHereAddLabel', {}, '')}>
          <Command.Input placeholder={tOr('studio.startHereSearch', {}, '')} />
          <Command.List>
            <Command.Empty>{tOr('studio.startHereNothingToAdd', {}, '')}</Command.Empty>
            {choices.map((video) => {
              const title = video.title ?? tOr('browse.untitled', {}, '');

              return (
                <Command.Item
                  key={video.id}
                  value={video.id}
                  keywords={[title]}
                  onSelect={() => onPick(video)}
                >
                  {title}
                </Command.Item>
              );
            })}
            {hasNextPage && (
              <Command.Item
                value="more"
                forceMount
                disabled={isFetchingNextPage}
                onSelect={() => void fetchNextPage()}
              >
                {tOr('studio.startHereLoadMore', {}, '')}
              </Command.Item>
            )}
          </Command.List>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>
  );
}

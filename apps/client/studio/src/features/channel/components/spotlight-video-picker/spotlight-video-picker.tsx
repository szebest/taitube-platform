import { useInfiniteQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useApi } from '@vp/queries';
import { Button, Command, Popover } from '@vp/ui';
import { pickableVideosQueryOptions } from '#app/features/channel/api/channel-featured';

interface SpotlightVideoPickerProps {
  label: string;
  videoId: string | null;
  onChange: (videoId: string | null) => void;
}

/** One video of the creator's public, ready ones, picked from a searchable list or cleared. */
export function SpotlightVideoPicker({ label, videoId, onChange }: SpotlightVideoPickerProps) {
  const { tOr } = useT();
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery(
    pickableVideosQueryOptions(useApi())
  );
  const videos = (data?.pages ?? []).flatMap(({ items }) => items);
  const chosen = videos.find(({ id }) => id === videoId);
  const current =
    videoId === null
      ? tOr('studio.spotlightNone', {}, '')
      : (chosen?.title ?? tOr('studio.spotlightSet', {}, ''));

  return (
    <div className="flex flex-wrap items-center gap-stack" role="group" aria-label={label}>
      <span className="text-label">{label}</span>
      <span className="text-fg-muted">{current}</span>
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="outline">
            {tOr(videoId === null ? 'studio.spotlightChoose' : 'studio.spotlightChange', {}, '')}
          </Button>
        </Popover.Trigger>
        <Popover.Content align="start" className="p-0">
          <Command.Root aria-label={label}>
            <Command.Input placeholder={tOr('studio.startHereSearch', {}, '')} />
            <Command.List>
              <Command.Empty>{tOr('studio.startHereNothingToAdd', {}, '')}</Command.Empty>
              {videos.map((video) => {
                const title = video.title ?? tOr('browse.untitled', {}, '');

                return (
                  <Command.Item
                    key={video.id}
                    value={video.id}
                    keywords={[title]}
                    onSelect={() => onChange(video.id)}
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
      {videoId !== null && (
        <Button variant="ghost" onClick={() => onChange(null)}>
          {tOr('studio.spotlightClear', {}, '')}
        </Button>
      )}
    </div>
  );
}

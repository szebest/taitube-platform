import { Avatar, Command } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { useState } from 'react';
import { channelSearchQueryOptions } from '#app/features/library/api/playlist-picker-queries';
import { useDebouncedValue } from '#app/hooks/use-debounced-value';
import { useT } from '#app/lib/messages';

const SEARCH_DELAY_MS = 250;

export interface PickedChannel {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ChannelPickerProps {
  /** The finished name of the search box. */
  label: string;
  onPick: (channel: PickedChannel) => void;
  /** Channels already picked, left out of the results. */
  exclude?: readonly string[];
}

/** Finds channels by name or handle as they are typed, through search, and hands back the one picked. */
export function ChannelPicker({ label, onPick, exclude = [] }: ChannelPickerProps) {
  const [typed, setTyped] = useState('');
  const { tOr } = useT();
  const query = useDebouncedValue(typed.trim().replace(/^@/, ''), SEARCH_DELAY_MS);
  const found = useQuery(channelSearchQueryOptions(useApi(), query));

  const channels = (found.data ?? []).filter(({ id }) => !exclude.includes(id));

  return (
    <Command.Root shouldFilter={false} label={label} className="min-w-0">
      <Command.Input
        aria-label={label}
        value={typed}
        onValueChange={setTyped}
        placeholder={tOr('playlistPeople.handlePlaceholder', {}, '')}
      />
      {query.length > 0 && found.isSuccess && channels.length === 0 && (
        <p role="status" className="m-0 px-2 py-1 text-body-sm text-fg-muted">
          {tOr('playlistPeople.noChannels', {}, '')}
        </p>
      )}
      <Command.List>
        {query.length > 0 &&
          channels.map((channel) => (
            <Command.Item
              key={channel.id}
              value={channel.id}
              onSelect={() => {
                onPick(channel);
                setTyped('');
              }}
              className="flex items-center gap-inline"
            >
              <Avatar.Root size="sm" aria-hidden="true">
                {channel.avatarUrl && <Avatar.Image src={channel.avatarUrl} alt="" />}
                <Avatar.Fallback>{channel.displayName.slice(0, 1)}</Avatar.Fallback>
              </Avatar.Root>
              <span className="truncate">{channel.displayName}</span>
              <span className="truncate text-fg-muted">@{channel.handle}</span>
            </Command.Item>
          ))}
      </Command.List>
    </Command.Root>
  );
}

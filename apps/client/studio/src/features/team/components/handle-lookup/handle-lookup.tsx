import { Command } from '@kit/ui';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';
import { useDeferredValue, useState } from 'react';
import { channelLookupQueryOptions } from '#app/features/team/api/team-queries';
import { useT } from '#app/lib/messages';

export interface FoundChannel {
  id: string;
  handle: string;
  displayName: string;
}

export interface HandleLookupProps {
  onPick: (channel: FoundChannel) => void;
}

/** Finds the channel behind a handle as it is typed, for the invite to name; the API checks the handle again on send. */
export function HandleLookup({ onPick }: HandleLookupProps) {
  const { tOr } = useT();
  const [typed, setTyped] = useState('');
  const handle = useDeferredValue(typed.trim().replace(/^@/, ''));
  const found = useQuery(channelLookupQueryOptions(useApi(), handle));

  return (
    <Command.Root shouldFilter={false} aria-label={tOr('studio.teamInviteHandleLabel', {}, '')}>
      <Command.Input
        value={typed}
        onValueChange={setTyped}
        placeholder={tOr('studio.teamInviteHandlePlaceholder', {}, '')}
      />
      <Command.List>
        {handle.length > 0 && found.isError && (
          <Command.Empty>{tOr('studio.teamInviteNoChannel', {}, '')}</Command.Empty>
        )}
        {found.data && (
          <Command.Item
            value={found.data.id}
            onSelect={() => {
              onPick(found.data);
              setTyped(found.data.handle);
            }}
          >
            {found.data.displayName}
            <span className="text-fg-muted">@{found.data.handle}</span>
          </Command.Item>
        )}
      </Command.List>
    </Command.Root>
  );
}

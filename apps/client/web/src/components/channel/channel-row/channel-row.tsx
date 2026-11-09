import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { Button } from '@vp/ui';
import type { ReactNode } from 'react';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { SubscribeAction } from '#app/components/channel/subscribe-action';

export interface ChannelRowProps {
  channel: {
    id: string;
    displayName: string;
    handle: string;
    avatarUrl: string | null;
    subscriberCount: number;
  };
  /** The channel's bio, drawn under the stats; a search result passes it with the matches marked. */
  bio?: ReactNode;
}

/** A channel as a row: its identity, Subscribe, and a link to the channel page. */
export function ChannelRow({ channel, bio }: ChannelRowProps) {
  const { tOr } = useT();

  return (
    <ChannelHeader.Root layout="identity">
      <ChannelHeader.Identity
        name={channel.displayName}
        handle={tOr('channels.handle', { handle: channel.handle }, '')}
        avatarSrc={channel.avatarUrl ?? undefined}
        stats={tOr('channels.subscribers', { count: channel.subscriberCount }, '')}
      >
        {bio && <ChannelHeader.Bio>{bio}</ChannelHeader.Bio>}
        <ChannelHeader.Actions>
          <SubscribeAction channelId={channel.id} />
          <Button asChild variant="soft" tone="neutral">
            <Link to="/channel/$channelId" params={{ channelId: channel.id }}>
              {tOr('channels.viewChannel', {}, '')}
            </Link>
          </Button>
        </ChannelHeader.Actions>
      </ChannelHeader.Identity>
    </ChannelHeader.Root>
  );
}

import type { Channel } from '@vp/api-contracts';
import type { ReactNode } from 'react';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { SubscribeAction } from '#app/components/channel/subscribe-action';
import { avatarSrcSet } from '#app/features/channel/utils/avatar-src-set';
import { useT } from '#app/lib/messages';
import { ChannelBanner } from '../channel-banner/channel-banner';

export interface ChannelIdentityHeaderProps {
  channel: Channel;
  /** The tab strip: `ChannelHeader.Tabs`. */
  children: ReactNode;
}

/** A channel page's header: banner, identity with Subscribe, and the tab strip it is given. */
export function ChannelIdentityHeader({ channel, children }: ChannelIdentityHeaderProps) {
  const { tOr } = useT();

  return (
    <ChannelHeader.Root>
      <ChannelBanner channel={channel} />
      <ChannelHeader.Identity
        name={channel.displayName}
        handle={tOr('channels.handle', { handle: channel.handle }, '')}
        avatarSrc={channel.avatar?.sizes['128'] ?? channel.avatarUrl ?? undefined}
        avatarSrcSet={channel.avatar ? avatarSrcSet(channel.avatar) : undefined}
        stats={tOr('channels.subscribers', { count: channel.subscriberCount }, '')}
      >
        {channel.bio && <ChannelHeader.Bio>{channel.bio}</ChannelHeader.Bio>}
        <ChannelHeader.Actions>
          <SubscribeAction channelId={channel.id} className="max-medium:flex-1" />
        </ChannelHeader.Actions>
      </ChannelHeader.Identity>
      {children}
    </ChannelHeader.Root>
  );
}

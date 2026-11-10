import { useSuspenseQuery } from '@tanstack/react-query';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { BrandScope } from '@vp/ui';
import { Suspense } from 'react';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { SubscribeAction } from '#app/components/channel/subscribe-action';
import { VideoGridSkeleton } from '#app/components/video/video-grid';
import { avatarSrcSet } from '#app/features/channel/utils/avatar-src-set';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import { ChannelAbout } from '../channel-about/channel-about';
import { ChannelBanner } from '../channel-banner/channel-banner';
import { ChannelPageSpotlight } from '../channel-page-spotlight/channel-page-spotlight';
import { ChannelStartHere } from '../channel-start-here/channel-start-here';
import { OwnVideos } from '../own-videos/own-videos';

/** A channel's page, by the id both of its addresses resolve to: the header, the spotlight, Start here and About. */
export function ChannelPage({ channelId }: { channelId: string }) {
  const api = useApi();
  const account = useAccount();
  const { tOr } = useT();
  const { data: channel } = useSuspenseQuery(channelQueryOptions(api, channelId));

  return (
    <BrandScope color={channel.brandColor}>
      <div className="flex flex-col gap-8">
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
        </ChannelHeader.Root>
        <ChannelPageSpotlight channelId={channel.id} />
        <ChannelStartHere channelId={channel.id} />
        {account?.channel.id === channel.id && (
          <Suspense fallback={<VideoGridSkeleton />}>
            <OwnVideos />
          </Suspense>
        )}
        <ChannelAbout channel={channel} />
      </div>
    </BrandScope>
  );
}

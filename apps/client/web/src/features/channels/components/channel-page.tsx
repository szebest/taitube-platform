import { useSuspenseQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAccount, useApi } from '@vp/queries';
import { BrandScope } from '@vp/ui';
import { Suspense } from 'react';

import { ChannelHeader } from '#app/components/channel/channel-header';
import { VideoGridSkeleton } from '#app/features/browse/components/video-grid/video-grid';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { SubscribeAction } from '#app/features/subscriptions/components/subscribe-action';
import { ChannelStartHere } from './channel-start-here';
import { OwnVideos } from './own-videos';

export function ChannelPage() {
  const { channelId } = useParams({ from: '/channel/$channelId' });
  const api = useApi();
  const account = useAccount();
  const { tOr } = useT();
  const { data: channel } = useSuspenseQuery(channelQueryOptions(api, channelId));

  return (
    <BrandScope color={channel.brandColor}>
      <div className="flex flex-col gap-8">
        <ChannelHeader.Root>
          <ChannelHeader.Banner src={channel.bannerUrl ?? undefined} />
          <ChannelHeader.Identity
            name={channel.displayName}
            handle={tOr('channels.handle', { handle: channel.handle }, '')}
            avatarSrc={channel.avatarUrl ?? undefined}
            stats={tOr('channels.subscribers', { count: channel.subscriberCount }, '')}
          >
            {channel.bio && <ChannelHeader.Bio>{channel.bio}</ChannelHeader.Bio>}
            <ChannelHeader.Actions>
              <SubscribeAction channelId={channel.id} />
            </ChannelHeader.Actions>
          </ChannelHeader.Identity>
        </ChannelHeader.Root>
        <ChannelStartHere channelId={channelId} />
        {account?.channel.id === channelId && (
          <Suspense fallback={<VideoGridSkeleton />}>
            <OwnVideos />
          </Suspense>
        )}
      </div>
    </BrandScope>
  );
}

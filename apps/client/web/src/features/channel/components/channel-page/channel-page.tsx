import { BrandScope } from '@kit/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { useAccount, useApi } from '@vp/queries';
import { Suspense } from 'react';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { VideoGridSkeleton } from '#app/components/video/video-grid';
import { CHANNEL_TABS } from '#app/features/channel/utils/channel-search';
import { useT } from '#app/lib/messages';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import { ChannelAbout } from '../channel-about/channel-about';
import { ChannelIdentityHeader } from '../channel-identity-header/channel-identity-header';
import { ChannelPageSpotlight } from '../channel-page-spotlight/channel-page-spotlight';
import { ChannelPosts } from '../channel-posts/channel-posts';
import { ChannelStartHere } from '../channel-start-here/channel-start-here';
import { OwnVideos } from '../own-videos/own-videos';

/** A channel's page, by the id both of its addresses resolve to: the header with its sections, then the home (spotlight, Start here, About) or the Posts. */
export function ChannelPage({ channelId }: { channelId: string }) {
  const api = useApi();
  const account = useAccount();
  const { tOr } = useT();
  const tab = useSearch({
    strict: false,
    select: ({ tab: open }) => CHANNEL_TABS.find((candidate) => candidate === open) ?? 'home',
  });
  const { data: channel } = useSuspenseQuery(channelQueryOptions(api, channelId));

  return (
    <BrandScope color={channel.brandColor}>
      <div className="flex flex-col gap-8">
        <ChannelIdentityHeader channel={channel}>
          <ChannelHeader.Tabs>
            {CHANNEL_TABS.map((value) => (
              <ChannelHeader.Tab key={value} asChild active={tab === value}>
                <Link to="." search={{ tab: value === 'home' ? undefined : value }} replace>
                  {tOr('posts.channelTab', { tab: value }, '')}
                </Link>
              </ChannelHeader.Tab>
            ))}
          </ChannelHeader.Tabs>
        </ChannelIdentityHeader>
        {tab === 'posts' ? (
          <ChannelPosts channelId={channel.id} />
        ) : (
          <>
            <ChannelPageSpotlight channelId={channel.id} />
            <ChannelStartHere channelId={channel.id} />
            {account?.channel.id === channel.id && (
              <Suspense fallback={<VideoGridSkeleton />}>
                <OwnVideos />
              </Suspense>
            )}
            <ChannelAbout channel={channel} />
          </>
        )}
      </div>
    </BrandScope>
  );
}

import { EmptyLibraryIllustration, EmptyState } from '@kit/components';
import { assertNever } from '@kit/result';
import type { Channel, ChannelPageView } from '@vp/api-contracts';
import { useAccount } from '@vp/queries';
import { Suspense } from 'react';
import { VideoGridSkeleton } from '#app/components/video/video-grid';
import { useT } from '#app/lib/messages';
import { ChannelAbout } from '../channel-about/channel-about';
import { ChannelFixedTab } from '../channel-fixed-tab/channel-fixed-tab';
import { ChannelPageSpotlight } from '../channel-page-spotlight/channel-page-spotlight';
import { ChannelPosts } from '../channel-posts/channel-posts';
import { OwnVideos } from '../own-videos/own-videos';
import { PageSection } from '../page-section/page-section';

export interface PageTabBodyProps {
  channel: Channel;
  page: ChannelPageView;
}

function Sections({ channel, page }: PageTabBodyProps) {
  const { tOr } = useT();

  if (page.tab.sections.length === 0) {
    return (
      <EmptyState.Root size="section">
        <EmptyState.Illustration>
          <EmptyLibraryIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title>{tOr('channelPage.empty', {}, '')}</EmptyState.Title>
      </EmptyState.Root>
    );
  }

  return page.tab.sections.map((section) => (
    <PageSection key={section.id} section={section} handle={channel.handle} images={page.images} />
  ));
}

/** What a tab shows: the creator's sections on Home and a custom tab (a custom tab under its header and description), the fixed body of every other built-in tab. */
export function PageTabBody({ channel, page }: PageTabBodyProps) {
  const account = useAccount();
  const { tab } = page;
  const header = tab.header ? page.images[tab.header] : undefined;

  switch (tab.kind) {
    case 'home':
      return (
        <>
          <ChannelPageSpotlight channelId={channel.id} />
          <Sections channel={channel} page={page} />
          {account?.channel.id === channel.id && (
            <Suspense fallback={<VideoGridSkeleton />}>
              <OwnVideos />
            </Suspense>
          )}
        </>
      );
    case 'custom':
      return (
        <>
          {header && (
            <img
              src={header.w1280}
              srcSet={`${header.w640} 640w, ${header.w1280} 1280w`}
              sizes="100vw"
              alt=""
              className="aspect-[3/1] w-full rounded-card object-cover"
            />
          )}
          {tab.description && (
            <p className="m-0 max-w-reading-max text-body text-fg-muted">{tab.description}</p>
          )}
          <Sections channel={channel} page={page} />
        </>
      );
    case 'videos':
    case 'shorts':
    case 'playlists':
      return <ChannelFixedTab kind={tab.kind} channelId={channel.id} />;
    case 'posts':
      return <ChannelPosts channelId={channel.id} />;
    case 'about':
      return <ChannelAbout channel={channel} />;
    default:
      return assertNever(tab.kind, 'TabKind');
  }
}

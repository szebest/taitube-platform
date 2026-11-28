import { BrandScope } from '@kit/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useApi } from '@vp/queries';
import { ChannelHeader } from '#app/components/channel/channel-header';
import { useT } from '#app/lib/messages';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import {
  type ChannelPageArgs,
  channelPageQueryOptions,
} from '#app/lib/query-keys/channel-page-keys';
import { ChannelIdentityHeader } from '../channel-identity-header/channel-identity-header';
import { PageTabBody } from '../page-tab-body/page-tab-body';

export interface ChannelLandingProps {
  args: ChannelPageArgs;
}

/** A channel's page as the API resolved it for this viewer: the header with the tabs they see, then the tab they asked for, with a line saying so when it is the draft. */
export function ChannelLanding({ args }: ChannelLandingProps) {
  const api = useApi();
  const { tOr } = useT();
  const { data: channel } = useSuspenseQuery(channelQueryOptions(api, args.channelId));
  const { data: page } = useSuspenseQuery(channelPageQueryOptions(api, args));

  return (
    <BrandScope color={channel.brandColor}>
      <div className="flex flex-col gap-8">
        {args.preview !== null && (
          <p
            role="status"
            className="m-0 rounded-card bg-accent-soft p-inset-control text-label text-accent-ink"
          >
            {tOr('channelPage.previewing', { audience: args.preview }, '')}
          </p>
        )}
        <ChannelIdentityHeader channel={channel}>
          <ChannelHeader.Tabs aria-label={tOr('channelPage.tabsLabel', {}, '')}>
            {page.tabs.map((tab) => (
              <ChannelHeader.Tab key={tab.id} asChild active={tab.slug === page.tab.slug}>
                <Link
                  to="/channels/$handle/$slug"
                  params={{ handle: channel.handle, slug: tab.slug }}
                  search={(previous) => previous}
                >
                  {tab.title}
                </Link>
              </ChannelHeader.Tab>
            ))}
          </ChannelHeader.Tabs>
        </ChannelIdentityHeader>
        <PageTabBody channel={channel} page={page} />
      </div>
    </BrandScope>
  );
}

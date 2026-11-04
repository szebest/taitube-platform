import { createQueryClient, myVideosQueryOptions } from '@vp/queries';
import { api, CHANNEL_ID, channel, feedPages, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders, signedIn } from '#app/__tests__/providers';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { ChannelPage } from '../channel-page';

function renderChannel(Providers = AppProviders, bio: string | null = null) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(channelQueryOptions(api, CHANNEL_ID).queryKey, channel({ bio }));
  queryClient.setQueryData(
    myVideosQueryOptions(api).queryKey,
    feedPages([videoSummary({ title: 'My upload' })])
  );

  return renderPage(<ChannelPage />, Providers, {
    queryClient,
    url: `/channel/${CHANNEL_ID}`,
    route: '/channel/$channelId',
  });
}

describe('apps/client/web: channel page', () => {
  it("shows someone else's channel as the page heading, without their video list", async () => {
    const markup = await renderChannel();

    expect(markup).toContain('>The Creator</h1>');
    expect(markup).not.toContain('Your videos');
  });

  it("adds the video list on the viewer's own channel", async () => {
    const markup = await renderChannel(signedIn());

    expect(markup).toContain('>Your videos</h2>');
    expect(markup).toContain('My upload');
  });

  it('draws the bio when the channel has one', async () => {
    expect(await renderChannel(AppProviders, 'Films about trams')).toContain('Films about trams');
  });
});

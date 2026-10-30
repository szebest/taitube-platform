import { createQueryClient, myVideosQueryOptions } from '@vp/queries';
import { api, CHANNEL_ID, channel, feedPages, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { UserPage } from '../user-page';

function withChannel() {
  const queryClient = createQueryClient();
  queryClient.setQueryData(channelQueryOptions(api, CHANNEL_ID).queryKey, channel());
  return queryClient;
}

async function renderChannel(
  queryClient = withChannel(),
  Providers = AppProviders
): Promise<string> {
  return renderPage(<UserPage />, Providers, {
    queryClient,
    url: `/channel/${CHANNEL_ID}`,
    route: '/channel/$channelId',
  });
}

describe('apps/client/web: user page', () => {
  it("shows someone else's channel without their video list", async () => {
    const markup = await renderChannel();

    expect(markup).toContain('The Creator');
    expect(markup).not.toContain('Your videos:');
  });

  it("adds the video list on the viewer's own channel", async () => {
    const queryClient = withChannel();
    queryClient.setQueryData(
      myVideosQueryOptions(api).queryKey,
      feedPages([videoSummary({ title: 'My upload' })])
    );

    const markup = await renderChannel(queryClient, signedIn());

    expect(markup).toContain('Your videos:');
    expect(markup).toContain('My upload');
  });
});

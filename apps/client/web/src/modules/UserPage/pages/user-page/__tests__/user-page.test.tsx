import { createQueryClient, myVideosQueryOptions } from '@vp/queries';
import { AppearanceProvider, DEFAULT_APPEARANCE } from '@vp/ui';
import { api, CHANNEL_ID, channel, feedPages, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import type { PropsWithChildren } from 'react';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { channelQueryOptions } from '#app/features/channels/api/channel-queries';
import { UserPage } from '../user-page';

function withChannel(brandColor: string | null = null) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(channelQueryOptions(api, CHANNEL_ID).queryKey, channel({ brandColor }));
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

function viewerWithAccent(accent: string) {
  return ({ children }: PropsWithChildren) => (
    <AppProviders>
      <AppearanceProvider
        stored={{ preference: { ...DEFAULT_APPEARANCE, accent }, source: 'appearance' }}
      >
        {children}
      </AppearanceProvider>
    </AppProviders>
  );
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

  it.each(['#3366cc', '#ffff00', '#fefefe', '#010101'])(
    "scopes the channel's derived accent %s to its page",
    async (brandColor) => {
      const markup = await renderChannel(withChannel(brandColor));

      expect(markup).toContain(`data-brand="${brandColor.slice(1)}"`);
      expect(markup).toContain(`[data-brand="${brandColor.slice(1)}"] {`);
    }
  );

  it.each([
    { name: 'a channel with no brand colour', brandColor: null, Providers: AppProviders },
    {
      name: "a viewer's own accent",
      brandColor: '#3366cc',
      Providers: viewerWithAccent('#aa2200'),
    },
  ])('leaves the theme accent alone for $name', async ({ brandColor, Providers }) => {
    const markup = await renderChannel(withChannel(brandColor), Providers);

    expect(markup).toContain('The Creator');
    expect(markup).not.toContain('data-brand');
  });
});

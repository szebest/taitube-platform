import { createQueryClient, myVideosQueryOptions } from '@vp/queries';
import { AppearanceProvider, DEFAULT_APPEARANCE } from '@vp/ui';
import { api, CHANNEL_ID, channel, feedPages, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import type { PropsWithChildren } from 'react';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { channelQueryOptions } from '#app/lib/query-keys/channel-keys';
import { ChannelPage } from '../channel-page';

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

interface ChannelOptions {
  Providers?: typeof AppProviders;
  bio?: string | null;
  brandColor?: string | null;
}

function renderChannel({
  Providers = AppProviders,
  bio = null,
  brandColor = null,
}: ChannelOptions = {}) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(
    channelQueryOptions(api, CHANNEL_ID).queryKey,
    channel({ bio, brandColor })
  );
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
    const markup = await renderChannel({ Providers: signedIn() });

    expect(markup).toContain('>Your videos</h2>');
    expect(markup).toContain('My upload');
  });

  it('draws the bio when the channel has one', async () => {
    expect(await renderChannel({ bio: 'Films about trams' })).toContain('Films about trams');
  });

  it.each(['#3366cc', '#ffff00', '#fefefe', '#010101'])(
    "scopes the channel's derived accent %s to its page",
    async (brandColor) => {
      const markup = await renderChannel({ brandColor });

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
    const markup = await renderChannel({ brandColor, Providers });

    expect(markup).toContain('The Creator');
    expect(markup).not.toContain('data-brand');
  });
});

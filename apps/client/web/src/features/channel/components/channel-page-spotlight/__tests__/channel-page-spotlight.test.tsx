import type { ChannelSpotlight } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { account, api, CHANNEL_ID, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';
import { AppProviders, signedIn } from '#app/__tests__/providers';
import { channelSpotlightQueryOptions } from '#app/lib/query-keys/channel-keys';
import { ChannelPageSpotlight } from '../channel-page-spotlight';

const VIDEO_ID = '0190a1b2-0000-7000-8000-000000000031';
const VIDEO = videoSummary({ id: VIDEO_ID, title: 'Two minutes', durationMs: 124_000 });

function renderSpotlight(
  spotlight: ChannelSpotlight | undefined,
  {
    viewerId = null,
    Providers = AppProviders,
  }: { viewerId?: string | null; Providers?: typeof AppProviders } = {}
) {
  const queryClient = createQueryClient();
  if (spotlight) {
    queryClient.setQueryData(
      channelSpotlightQueryOptions(api, CHANNEL_ID, 'en', viewerId).queryKey,
      spotlight
    );
  }
  return renderPage(<ChannelPageSpotlight channelId={CHANNEL_ID} />, Providers, { queryClient });
}

describe('apps/client/web: ChannelPageSpotlight', () => {
  it.each([
    { source: 'trailer' as const, kicker: 'Channel trailer' },
    { source: 'returning' as const, kicker: 'Welcome back' },
  ])(
    'names the $source video "$kicker" and links it to its watch page',
    async ({ source, kicker }) => {
      const markup = await renderSpotlight({ source, video: VIDEO });

      expect(markup).toContain(`data-source="${source}"`);
      expect(markup).toContain(kicker);
      expect(markup).toContain(`href="/watch/${VIDEO_ID}"`);
      expect(markup).toContain('>Two minutes</a>');
      expect(markup).toContain('Watch');
    }
  );

  it.each([
    { name: 'nothing to show', spotlight: { source: null, video: null } },
    { name: 'no answer yet', spotlight: undefined },
  ])('renders nothing for $name', async ({ spotlight }) => {
    expect(await renderSpotlight(spotlight)).toBe('');
  });

  it('reads the entry of the viewer who is looking, never the guest one', async () => {
    const viewer = account();
    const trailer = { source: 'trailer' as const, video: VIDEO };

    expect(
      await renderSpotlight(trailer, { viewerId: viewer.id, Providers: signedIn(viewer) })
    ).toContain('Channel trailer');
    expect(await renderSpotlight(trailer, { Providers: signedIn(viewer) })).toBe('');
  });
});

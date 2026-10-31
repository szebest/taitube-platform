import type { ChannelFeaturedView } from '@vp/api-contracts';
import { createQueryClient } from '@vp/queries';
import { api, CHANNEL_ID, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { channelStartHereQueryOptions } from '#app/features/channels/api/channel-queries';
import { ChannelStartHere } from '../channel-start-here';

const FIRST = '0190a1b2-0000-7000-8000-000000000011';
const SECOND = '0190a1b2-0000-7000-8000-000000000012';

const view = (source: ChannelFeaturedView['source'], titles: string[]): ChannelFeaturedView => ({
  source,
  items: titles.map((title, index) => videoSummary({ id: index === 0 ? FIRST : SECOND, title })),
});

function renderShelf(featured?: ChannelFeaturedView) {
  const queryClient = createQueryClient();
  if (featured) {
    queryClient.setQueryData(channelStartHereQueryOptions(api, CHANNEL_ID).queryKey, featured);
  }
  return renderPage(<ChannelStartHere channelId={CHANNEL_ID} />, AppProviders, { queryClient });
}

describe('apps/client/web: channel start here', () => {
  it.each([
    { source: 'pinned' as const, heading: 'Start here', attribution: 'Pinned by creator' },
    { source: 'popular' as const, heading: 'Most watched', attribution: 'Most viewed' },
  ])('titles the $source shelf "$heading" on the server render', async (expected) => {
    const markup = await renderShelf(view(expected.source, ['Lisbon', 'Tram']));

    expect(markup).toContain(`>${expected.heading}</h2>`);
    expect(markup).toContain(expected.attribution);
  });

  it('lists the videos in the order the API answered, numbered only over pins', async () => {
    const pinned = await renderShelf(view('pinned', ['Second pick', 'First pick']));
    const popular = await renderShelf(view('popular', ['Second pick', 'First pick']));

    expect(pinned.indexOf('Second pick')).toBeLessThan(pinned.indexOf('First pick'));
    expect(pinned).toContain('data-slot="start-here-shelf-position"');
    expect(popular).not.toContain('data-slot="start-here-shelf-position"');
  });

  it.each([
    { scenario: 'it is not loaded', featured: undefined },
    { scenario: 'the channel has nothing public', featured: view('popular', []) },
  ])('renders nothing when $scenario', async ({ featured }) => {
    const markup = await renderShelf(featured);

    expect(markup).not.toContain('start-here-shelf');
  });
});

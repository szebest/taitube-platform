import type { HomeShelf as HomeShelfData } from '@vp/api-contracts';
import { VIDEO_ID, videoSummary } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders } from '#app/__tests__/providers';
import { HomeShelf } from '../home-shelf';

const shelfOf = (shelf: Partial<HomeShelfData> = {}): HomeShelfData => ({
  kind: 'trending',
  items: [{ ...videoSummary({ title: 'Tram ride' }), reason: { kind: 'trending' } }],
  ...shelf,
});

const renderShelf = (shelf: Partial<HomeShelfData> = {}) =>
  renderPage(<HomeShelf shelf={shelfOf(shelf)} />, AppProviders);

describe('apps/client/web: home shelf', () => {
  it.each([
    { kind: 'continue' as const, heading: 'Continue watching' },
    { kind: 'subscriptions' as const, heading: 'From your subscriptions' },
    { kind: 'trending' as const, heading: 'Trending now' },
    {
      kind: 'because-watched' as const,
      subject: { kind: 'video' as const, id: VIDEO_ID, name: 'Lisbon at night' },
      heading: 'Because you watched Lisbon at night',
    },
    {
      kind: 'category' as const,
      subject: { kind: 'category' as const, id: VIDEO_ID, name: 'Music' },
      heading: 'Popular in Music',
    },
  ])('heads a $kind shelf with "$heading"', async ({ heading, ...shelf }) => {
    const markup = await renderShelf(shelf);

    expect(markup).toContain(`>${heading}</h2>`);
  });

  it('shows every item as a card under the reason it was picked', async () => {
    const markup = await renderShelf({
      items: [
        { ...videoSummary({ title: 'Tram ride' }), reason: { kind: 'co-watched' } },
        { ...videoSummary({ title: 'Fado night' }), reason: { kind: 'same-channel' } },
      ],
    });

    expect(markup).toContain('>Tram ride</a>');
    expect(markup).toContain('Viewers also watched');
    expect(markup).toContain('>Fado night</a>');
    expect(markup).toContain('From the same channel');
  });
});

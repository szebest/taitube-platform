import type { PageItemView } from '@vp/api-contracts';
import { renderPage } from '@vp/web-testing/server';
import { PRESENTATION, SERIES_VIDEO, videoItem } from '#app/__tests__/channel-page-fixtures';
import { AppProviders, withToasts } from '#app/__tests__/providers';
import { PageItemCard } from '../page-item-card';

const BASE = { id: SERIES_VIDEO, thumbnailUrl: null, createdAt: '2026-11-01T10:00:00.000Z' };

const renderCard = (item: PageItemView, show = PRESENTATION.show) =>
  renderPage(
    <PageItemCard item={item} variant="grid" density="comfortable" show={show} />,
    withToasts(AppProviders)
  );

describe('apps/client/web: PageItemCard', () => {
  it.each([
    {
      item: videoItem('The pilot'),
      text: 'The pilot',
      href: `href="/watch/${SERIES_VIDEO}"`,
    },
    {
      item: { ...videoItem('A short'), format: 'short' as const },
      text: 'A short',
      href: `href="/shorts/${SERIES_VIDEO}"`,
    },
    {
      item: {
        ...BASE,
        kind: 'post' as const,
        title: 'Studio news',
        likesCount: 3,
        commentsCount: 1,
      },
      text: 'Studio news',
      href: `href="/post/${SERIES_VIDEO}"`,
    },
    {
      item: { ...BASE, kind: 'playlist' as const, title: 'Season one', itemCount: 4 },
      text: '4 videos',
      href: `href="/playlist?list=${SERIES_VIDEO}"`,
    },
    {
      item: {
        ...BASE,
        kind: 'live' as const,
        title: 'Premiere night',
        status: 'LIVE' as const,
        viewers: 12,
        videoId: null,
      },
      text: 'Live now',
      href: `href="/live/${SERIES_VIDEO}"`,
    },
    {
      item: {
        kind: 'channel' as const,
        channel: { id: SERIES_VIDEO, handle: 'friends', displayName: 'Friends', avatarUrl: null },
      },
      text: 'Friends',
      href: 'href="/channels/friends"',
    },
  ])(
    'draws a $item.kind as a card that links to what it points at',
    async ({ item, text, href }) => {
      const markup = await renderCard(item);

      expect(markup).toContain(text);
      expect(markup).toContain(href);
    }
  );

  it('shows the duration, views and date a section asks for, and no more', async () => {
    const shown = await renderCard(videoItem('The pilot'), {
      duration: true,
      views: true,
      date: false,
    });
    const hidden = await renderCard(videoItem('The pilot'), {
      duration: false,
      views: false,
      date: false,
    });

    expect(shown).toContain('2:05');
    expect(shown).toContain('1.2K views');
    expect(shown).not.toContain('<time');
    expect(hidden).not.toContain('2:05');
    expect(hidden).not.toContain('views');
  });
});

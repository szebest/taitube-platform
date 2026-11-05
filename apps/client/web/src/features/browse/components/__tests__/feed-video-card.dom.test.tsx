import { act, fireEvent, screen, within } from '@testing-library/react';
import {
  getCurrentPick,
  getHome,
  getShorts,
  type HomeShelf,
  listMyPlaylists,
  type VideoSummary,
} from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { writeCookie } from '@vp/ui';
import {
  CHANNEL_ID,
  mockEndpoint,
  problemReply,
  VIDEO_ID,
  videoSummary,
} from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const WATCH_LATER_ID = '0190c3a0-5e1d-7000-8000-00000000d001';

function homeWith(overrides: Partial<VideoSummary>, reason: HomeShelf['items'][number]['reason']) {
  return mockEndpoint(getHome, () =>
    HttpResponse.json({
      shelves: [{ kind: 'trending', items: [{ ...videoSummary(overrides), reason }] }],
    })
  );
}

const LAUNCH_DAY = {
  title: 'Launch day',
  thumbnailUrl: 'http://localhost:9000/thumbs/t.jpg',
  durationMs: 765_000,
  viewsCount: 1_200_000,
  viewer: { progressSeconds: 382, watchedAt: '2026-01-02T00:00:00.000Z' },
};

async function renderHome(overrides: Partial<VideoSummary> = LAUNCH_DAY, signedIn = false) {
  const handlers = [
    homeWith(overrides, { kind: 'shared-tags' }),
    mockEndpoint(getCurrentPick, () => problemReply(ErrorCodes.VIDEO_NOT_FOUND)),
    mockEndpoint(getShorts, () => HttpResponse.json({ items: [], nextCursor: null, total: 0 })),
    mockEndpoint(listMyPlaylists, () =>
      HttpResponse.json({
        items: [
          {
            id: WATCH_LATER_ID,
            title: 'Watch Later',
            visibility: 'private' as const,
            isSystem: true,
            videoCount: 0,
            containsVideo: false,
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
        ],
      })
    ),
  ];
  const rendered = await renderRoute(getRouter, '/', {
    handlers: signedIn ? [signInBrowser(), ...handlers] : handlers,
  });
  const card = within(await screen.findByRole('article'));
  return { ...rendered, card };
}

describe('apps/client/web: FeedVideoCard', () => {
  afterEach(() => {
    vi.useRealTimers();
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it.each([
    { hoverPreview: true, expanded: true },
    { hoverPreview: false, expanded: false },
  ])(
    'expands on a resting mouse when the hover preview is $hoverPreview: $expanded',
    async ({ hoverPreview, expanded }) => {
      writeCookie('vp.device', JSON.stringify({ schema: 1, playback: { hoverPreview } }), {
        maxAge: 60,
      });
      await renderHome();
      const article = screen.getByRole('article');

      vi.useFakeTimers();
      fireEvent.pointerOver(article, { pointerType: 'mouse' });
      act(() => vi.advanceTimersByTime(500));

      expect(article.hasAttribute('data-expanded')).toBe(expanded);
    }
  );

  it('shows the frame, the title, the channel, the views, the age and the reason', async () => {
    const { card } = await renderHome();

    expect(card.getByRole('link', { name: 'Launch day' })).toHaveAttribute(
      'href',
      `/watch/${VIDEO_ID}`
    );
    expect(card.getByRole('link', { name: 'The Creator' })).toHaveAttribute(
      'href',
      `/channel/${CHANNEL_ID}`
    );
    expect(card.getByText('12:45')).toHaveAttribute('aria-hidden', 'true');
    expect(card.getByText('12 minutes, 45 seconds')).toBeInTheDocument();
    expect(card.getByRole('progressbar', { name: 'Watched' })).toHaveAttribute(
      'aria-valuenow',
      '50'
    );
    expect(card.getByText(/1\.2M views/)).toHaveTextContent(/ago$/);
    expect(card.getByText('Similar topics')).toBeInTheDocument();
    expect(card.getByRole('presentation')).toHaveAttribute(
      'src',
      'http://localhost:9000/thumbs/t.jpg'
    );
  });

  it.each([
    {
      scenario: 'an untitled video with no channel, duration or playhead',
      overrides: { title: null, channel: null, viewer: null },
      shown: 'Untitled video',
    },
    {
      scenario: 'a video only a poster pictures',
      overrides: { posterUrl: 'http://localhost:9000/posters/p.jpg' },
      shown: 'A video',
    },
  ])('renders $scenario', async ({ overrides, shown }) => {
    const { card } = await renderHome(overrides);

    expect(card.getByRole('link', { name: shown })).toBeInTheDocument();
    expect(card.queryByRole('progressbar')).toBeNull();
  });

  it('offers a guest no actions', async () => {
    const { card } = await renderHome();

    expect(card.queryByRole('button', { name: 'More actions' })).toBeNull();
  });

  it("opens the save dialog from a member's card menu", async () => {
    const { card, user } = await renderHome(LAUNCH_DAY, true);

    await user.click(await card.findByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Save' }));

    expect(await screen.findByRole('dialog', { name: 'Save to playlist' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Queue' })).toBeNull();
  });
});

import { screen } from '@testing-library/react';
import { listMyPlaylists, setReaction, subscribeToChannel } from '@vp/api-contracts';
import { CHANNEL_ID, mockEndpoint, VIDEO_ID } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { rememberIntent } from '#app/lib/account-action/replay-intent';
import { getRouter } from '#app/router';

describe('apps/client/web: replaying an intent after sign-in', () => {
  afterEach(() => window.sessionStorage.clear());

  it('likes once for the viewer who pressed Like before signing in', async () => {
    const likes: unknown[] = [];
    rememberIntent({ kind: 'like', id: VIDEO_ID });

    await renderRoute(getRouter, '/', {
      handlers: [
        signInBrowser(),
        mockEndpoint(setReaction, async ({ request }) => {
          likes.push(await request.json());
          return HttpResponse.json({
            videoId: VIDEO_ID,
            reaction: 'LIKE',
            likesCount: 1,
            dislikesCount: 0,
          });
        }),
        ...loaderApi(),
      ],
    });

    await vi.waitFor(() => expect(likes).toEqual([{ type: 'LIKE' }]));
  });

  it('subscribes once for the viewer who pressed Subscribe before signing in', async () => {
    const subscribed: string[] = [];
    rememberIntent({ kind: 'subscribe', id: CHANNEL_ID });

    await renderRoute(getRouter, '/', {
      handlers: [
        signInBrowser(),
        mockEndpoint(subscribeToChannel, ({ params }) => {
          subscribed.push(String(params.id));
          return HttpResponse.json({ channelId: CHANNEL_ID, subscribed: true, subscriberCount: 1 });
        }),
        ...loaderApi(),
      ],
    });

    await vi.waitFor(() => expect(subscribed).toEqual([CHANNEL_ID]));
  });

  it('opens the save dialog for the viewer who pressed Save before signing in', async () => {
    rememberIntent({ kind: 'save', id: VIDEO_ID });

    await renderRoute(getRouter, '/', {
      handlers: [
        signInBrowser(),
        mockEndpoint(listMyPlaylists, () => HttpResponse.json({ items: [] })),
        ...loaderApi(),
      ],
    });

    expect(await screen.findByRole('dialog', { name: 'Save to playlist' })).toBeInTheDocument();
  });

  it('replays nothing for a guest, and nothing without an intent', async () => {
    const likes: unknown[] = [];
    rememberIntent({ kind: 'like', id: VIDEO_ID });

    await renderRoute(getRouter, '/', {
      handlers: [
        mockEndpoint(setReaction, () =>
          HttpResponse.json({
            videoId: VIDEO_ID,
            reaction: 'LIKE',
            likesCount: 1,
            dislikesCount: 0,
          })
        ),
        ...loaderApi(),
      ],
    });

    expect(likes).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

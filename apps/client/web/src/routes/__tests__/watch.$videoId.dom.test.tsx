import { screen } from '@testing-library/react';
import { getVideo, listVideoCorrections, unlockVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { videoKeys } from '@vp/queries';
import { mockEndpoint, problemReply, VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';
import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

const SHARE_TOKEN = 'abcdefghijklmnopqrstuv';

describe('apps/client/web: /watch/$videoId in the browser', () => {
  it('renders the video the loader fetched', async () => {
    await renderRoute(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: [
        mockEndpoint(getVideo, () => HttpResponse.json(video({ title: 'Launch day' }))),
        ...loaderApi(),
      ],
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Launch day' })
    ).toBeInTheDocument();
    expect(document.title).toBe('Launch day');
  });

  it.each([
    { search: '?t=90', t: 90 },
    { search: '?t=0', t: 0 },
    { search: '', t: undefined },
    { search: '?t=soon', t: undefined },
    { search: '?t=-5', t: undefined },
    { search: '?t=1.5', t: undefined },
  ])('reads $search as the start time $t', async ({ search, t }) => {
    const { router } = await renderRoute(getRouter, `/watch/${VIDEO_ID}${search}`, {
      handlers: loaderApi(),
    });

    await screen.findByRole('heading', { level: 1, name: 'Launch day' });

    const match = router.state.matches.find(({ routeId }) => routeId === '/watch/$videoId');
    expect(match?.search).toEqual({ t });
  });

  it('lists the related videos under the details, and opens one', async () => {
    const { router, user } = await renderRoute(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: loaderApi(),
    });

    await screen.findByRole('heading', { name: 'More like this' });
    await user.click(screen.getByRole('link', { name: 'Tram ride' }));

    expect(router.state.location.pathname).not.toBe(`/watch/${VIDEO_ID}`);
  });

  it("renders the route's error page when the API fails", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await renderRoute(getRouter, `/watch/${VIDEO_ID}`, {
      handlers: [mockEndpoint(getVideo, () => problemReply(ErrorCodes.INTERNAL)), ...loaderApi()],
    });

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Something went wrong on our side'
    );
  });

  it.each([
    { refusal: ErrorCodes.VIDEO_PASSWORD_INVALID, says: 'That password is not right.' },
    { refusal: ErrorCodes.RATE_LIMITED, says: 'Too many requests. Wait a moment and try again.' },
  ])(
    'gates a password-protected video, says $refusal on the field, and plays it once the right password unlocks it',
    async ({ refusal, says }) => {
      let unlocked = false;
      const { user } = await renderRoute(getRouter, `/watch/${VIDEO_ID}`, {
        handlers: [
          mockEndpoint(getVideo, () =>
            unlocked
              ? HttpResponse.json(video({ title: 'Launch day', passwordProtected: true }))
              : problemReply(ErrorCodes.VIDEO_PASSWORD_REQUIRED)
          ),
          mockEndpoint(unlockVideo, async ({ request }) => {
            const { password } = (await request.json()) as { password: string };
            if (password !== 'hunter22') return problemReply(refusal);
            unlocked = true;
            return new HttpResponse(null, { status: 204 });
          }),
          ...loaderApi(),
        ],
      });

      expect(
        await screen.findByRole('heading', { level: 1, name: 'This video is protected' })
      ).toBeInTheDocument();
      const field = screen.getByLabelText(/^Password/);
      await user.type(field, 'guess{Enter}');
      await vi.waitFor(() => expect(field).toHaveAccessibleDescription(says));

      await user.clear(field);
      await user.type(field, 'hunter22{Enter}');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Launch day' })
      ).toBeInTheDocument();
    }
  );

  it('sends the share link the URL carries, keeps it there, and says when it no longer works', async () => {
    const tokens: (string | null)[] = [];
    const { router } = await renderRoute(getRouter, `/watch/${VIDEO_ID}?s=${SHARE_TOKEN}`, {
      handlers: [
        mockEndpoint(getVideo, ({ request }) => {
          tokens.push(new URL(request.url).searchParams.get('s'));
          return problemReply(ErrorCodes.SHARE_LINK_EXPIRED);
        }),
        ...loaderApi(),
      ],
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This link no longer works' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/');
    expect(tokens).toEqual([SHARE_TOKEN]);
    expect(router.state.location.search).toMatchObject({ s: SHARE_TOKEN });
  });

  it('reads the video once, and sends the share link with every read of it and its corrections, a refetch after an invalidation included', async () => {
    const reads: string[] = [];
    const tokenOf = (request: Request) => new URL(request.url).searchParams.get('s');
    const { queryClient } = await renderRoute(getRouter, `/watch/${VIDEO_ID}?s=${SHARE_TOKEN}`, {
      handlers: [
        mockEndpoint(getVideo, ({ request }) => {
          reads.push(`video ${tokenOf(request)}`);
          return HttpResponse.json(video({ title: 'Launch day' }));
        }),
        mockEndpoint(listVideoCorrections, ({ request }) => {
          reads.push(`corrections ${tokenOf(request)}`);
          return HttpResponse.json({ items: [] });
        }),
        ...loaderApi(),
      ],
    });
    await screen.findByRole('heading', { level: 1, name: 'Launch day' });
    expect(reads.filter((read) => read.startsWith('video'))).toHaveLength(1);

    await queryClient.invalidateQueries({ queryKey: videoKeys.detail(VIDEO_ID) });

    expect(new Set(reads)).toEqual(new Set([`video ${SHARE_TOKEN}`, `corrections ${SHARE_TOKEN}`]));
    expect(reads.filter((read) => read.startsWith('video'))).toHaveLength(2);
  });
});

import { screen } from '@testing-library/react';
import { getVideo } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { mockEndpoint, problemReply, VIDEO_ID, video } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

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
      'There was an error while loading the page'
    );
  });
});

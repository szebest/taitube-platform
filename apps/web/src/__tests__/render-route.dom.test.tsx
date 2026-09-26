import { screen } from '@testing-library/react';
import { getFeed, getVideo, listCategories } from '@vp/api-contracts';
import { ErrorCodes } from '@vp/errors';
import { HttpResponse } from 'msw';

import { VIDEO_ID, videoSummary } from './fixtures';
import { mockEndpoint, problemReply } from './msw/mock-endpoint';
import { renderRoute } from './render-route';

describe('apps/web: renderRoute', () => {
  it('opens the url in the real route tree, with its fallbacks', async () => {
    const { router } = await renderRoute('/watch/not-a-video');

    expect(router.state.location.pathname).toBe('/watch/not-a-video');
    expect(screen.getByRole('alert')).toHaveTextContent('This page does not exist.');
  });

  it('puts the session it is handed in router context', async () => {
    const auth = { status: 'guest' } as const;

    const { router } = await renderRoute('/watch/not-a-video', { auth });

    expect(router.options.context.auth).toBe(auth);
  });

  it('asks the API once for a query that fails, without retrying', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let asked = 0;
    const failing = mockEndpoint(getVideo, () => {
      asked += 1;
      return problemReply(ErrorCodes.INTERNAL);
    });

    await renderRoute(`/watch/${VIDEO_ID}`, { handlers: [failing] });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(asked).toBe(1);
  });

  it('renders a live page a user can click through', async () => {
    const homePage = [
      mockEndpoint(listCategories, () => HttpResponse.json([])),
      mockEndpoint(getFeed, () =>
        HttpResponse.json({ items: [videoSummary({ title: 'Fresh' })], nextCursor: null, total: 1 })
      ),
    ];
    const { router, user } = await renderRoute('/watch/not-a-video', { handlers: homePage });

    await user.click(screen.getByRole('link', { name: 'Go to the home page' }));

    expect(await screen.findByText('Fresh')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });
});

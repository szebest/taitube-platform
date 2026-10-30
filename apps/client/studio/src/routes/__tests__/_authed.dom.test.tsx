import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { accountOf, devTokenServe, signInBrowser } from '#app/__tests__/providers';
import { serveLibrary } from '#app/features/content/__tests__/library-api.fixture';
import { getRouter } from '#app/router';

describe('apps/client/studio: members-only layout in the browser', () => {
  beforeEach(() => {
    serveLibrary([{ cursor: null, items: [], next: null }]);
  });

  it("sends a guest to the studio's own sign-in, and back to /videos once they have", async () => {
    const { router, user } = await renderRoute(getRouter, '/videos', {
      handlers: [devTokenServe(), accountOf()],
    });

    expect(router.state.location.href).toBe('/login?redirect=%2Fvideos');
    expect(screen.queryByRole('heading', { name: 'Your videos' })).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    expect(await screen.findByRole('heading', { name: 'Your videos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/videos');
  });

  it('shows a signed-in creator the page', async () => {
    await renderRoute(getRouter, '/videos', { handlers: [signInBrowser()] });

    expect(await screen.findByRole('heading', { name: 'Your videos' })).toBeInTheDocument();
  });
});

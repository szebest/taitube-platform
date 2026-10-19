import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { accountOf, devTokenServe, signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/studio: members-only layout in the browser', () => {
  it("sends a guest to the studio's own sign-in, and back to /upload once they have", async () => {
    const { router, user } = await renderRoute(getRouter, '/upload', {
      handlers: [devTokenServe(), accountOf()],
    });

    expect(router.state.location.href).toBe('/login?redirect=%2Fupload');
    expect(screen.queryByLabelText('Video title')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    expect(await screen.findByLabelText('Video title')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/upload');
  });

  it('shows a signed-in creator the page', async () => {
    await renderRoute(getRouter, '/upload', { handlers: [signInBrowser()] });

    expect(await screen.findByLabelText('Video title')).toBeInTheDocument();
  });
});

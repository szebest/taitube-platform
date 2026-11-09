import { screen } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';
import { serveLibrary } from '#app/__tests__/library-api.fixture';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/studio: /upload', () => {
  it('lands on the library with the upload dialog open', async () => {
    serveLibrary([{ cursor: null, items: [], next: null }]);

    const { router } = await renderRoute(getRouter, '/upload', { handlers: [signInBrowser()] });

    expect(await screen.findByRole('dialog', { name: 'Upload a video' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/videos');
  });
});

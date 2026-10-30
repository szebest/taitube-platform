import { screen } from '@testing-library/react';
import { listMyClips } from '@vp/api-contracts';
import { clip, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { devTokenServe, signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

describe('apps/client/web: /clips in the browser', () => {
  it("loads the viewer's clips and links each to its clip page", async () => {
    const mine = mockEndpoint(listMyClips, () =>
      HttpResponse.json({ items: [clip()], nextCursor: null })
    );

    await renderRoute(getRouter, '/clips', {
      handlers: [mine, signInBrowser(), ...loaderApi()],
    });

    expect(await screen.findByRole('heading', { name: 'Clips' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /The best part/ })).toBeInTheDocument();
  });

  it('sends a guest to sign in, and back to /clips once they have', async () => {
    const mine = mockEndpoint(listMyClips, () =>
      HttpResponse.json({ items: [clip()], nextCursor: null })
    );

    const { router, user } = await renderRoute(getRouter, '/clips', {
      handlers: [mine, devTokenServe(), ...loaderApi()],
    });

    expect(router.state.location.href).toBe('/login?redirect=%2Fclips');

    await user.click(await screen.findByRole('button', { name: 'Creator' }));

    expect(await screen.findByRole('heading', { name: 'Clips' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/clips');
  });
});

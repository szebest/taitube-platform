import { screen } from '@testing-library/react';
import { account } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { categoriesList } from '#app/features/admin/components/__tests__/categories.fixture';
import { serveLibrary } from '#app/features/content/__tests__/library-api.fixture';
import { getRouter } from '#app/router';

const renderAdmin = (url: string, role: 'ADMIN' | 'CREATOR') => {
  serveLibrary([{ cursor: null, items: [], next: null }]);
  return renderRoute(getRouter, url, {
    handlers: [signInBrowser(account({ role })), categoriesList([])],
  });
};

describe('apps/client/studio: /admin in the browser', () => {
  it.each(['/admin', '/admin/categories', '/admin/moderation', '/admin/queues'])(
    'sends a creator from %s to the studio root, which carries on to the library with the denial toast',
    async (url) => {
      const { router } = await renderAdmin(url, 'CREATOR');

      expect(await screen.findByText('Access denied')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/videos');
      expect(router.state.location.search).not.toHaveProperty('denied');
    }
  );

  it('opens the categories for an admin from /admin', async () => {
    const { router } = await renderAdmin('/admin', 'ADMIN');

    expect(router.state.location.pathname).toBe('/admin/categories');
    expect(screen.queryByText('Access denied')).not.toBeInTheDocument();
  });
});

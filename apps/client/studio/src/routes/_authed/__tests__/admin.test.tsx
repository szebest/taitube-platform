import { listAdminCategories } from '@vp/api-contracts';
import { account, mockEndpoint } from '@vp/web-testing';
import { serverRender } from '@vp/web-testing/server';
import { HttpResponse } from 'msw';

import { accountOf, SESSION } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const renderAdmin = (role: 'ADMIN' | 'CREATOR') =>
  serverRender(getRouter, '/admin/categories', {
    handlers: [
      accountOf(account({ role })),
      mockEndpoint(listAdminCategories, () => HttpResponse.json([])),
    ],
    headers: { cookie: SESSION },
  });

describe('apps/client/studio: /admin on the server', () => {
  it('redirects a creator before any admin HTML, carrying the denial', async () => {
    const { status, location, html } = await renderAdmin('CREATOR');

    expect(status).toBe(307);
    expect(location).toBe('/?denied=admin');
    expect(html).not.toContain('Moderation');
  });

  it('renders the page for an admin', async () => {
    const { status } = await renderAdmin('ADMIN');

    expect(status).toBe(200);
  });
});

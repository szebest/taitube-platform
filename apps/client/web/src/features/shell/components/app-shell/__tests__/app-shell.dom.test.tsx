import { screen } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { getRouter } from '#app/router';

afterEach(() => writeCookie('vp.sidebar', '', { maxAge: 0 }));

describe('apps/client/web: app shell', () => {
  it('collapses and expands the sidebar from the menu button and keeps the choice in a cookie', async () => {
    const { user } = await renderRoute(getRouter, '/', { handlers: loaderApi() });
    const menu = screen.getByRole('button', { name: 'Menu' });

    await user.click(menu);

    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(document.cookie).toContain('vp.sidebar=collapsed');

    await user.click(menu);

    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(document.cookie).toContain('vp.sidebar=expanded');
  });
});

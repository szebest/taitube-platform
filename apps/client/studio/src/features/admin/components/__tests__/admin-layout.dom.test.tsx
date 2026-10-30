import { screen } from '@testing-library/react';
import { account } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const renderLayout = (url: string) =>
  renderRoute(getRouter, url, { handlers: [signInBrowser(account({ role: 'ADMIN' }))] });

describe('apps/client/studio: AdminLayout', () => {
  it.each([
    { section: 'Categories', href: '/admin/categories' },
    { section: 'Moderation', href: '/admin/moderation' },
    { section: 'Queues', href: '/admin/queues' },
  ])('links the $section section and marks the open one', async ({ section, href }) => {
    await renderLayout(href);

    const link = screen.getByRole('link', { name: section });

    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(
      screen
        .getAllByRole('link', { current: 'page' })
        .filter((l) => l.closest('nav[aria-label="Admin sections"]'))
    ).toHaveLength(1);
  });
});

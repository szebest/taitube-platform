import { screen } from '@testing-library/react';
import { adminSection } from './categories.fixture';

describe('apps/client/studio: AdminLayout', () => {
  it.each([
    { section: 'Categories', href: '/admin/categories' },
    { section: 'Curation', href: '/admin/curation' },
    { section: 'Moderation', href: '/admin/moderation' },
    { section: 'Queues', href: '/admin/queues' },
  ])('links the $section section and marks the open one', async ({ section, href }) => {
    await adminSection(href);

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

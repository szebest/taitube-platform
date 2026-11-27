import { screen } from '@testing-library/react';
import { AdminPageSkeleton } from '#app/features/admin';
import { adminCategory, renderCategories } from '#app/features/admin/__tests__/categories.fixture';
import { Route } from '../categories';

describe('apps/client/studio: /admin/categories', () => {
  it('shows its skeleton while the loader runs', () => {
    expect(Route.options.pendingComponent).toBe(AdminPageSkeleton);
  });

  it('has the categories loaded before the page first renders', async () => {
    await renderCategories([adminCategory({ name: 'Music' })]);

    expect(screen.getByText('Music')).toBeInTheDocument();
  });
});

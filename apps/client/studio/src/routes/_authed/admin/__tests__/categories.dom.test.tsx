import { screen } from '@testing-library/react';

import {
  adminCategory,
  renderCategories,
} from '#app/features/admin/components/__tests__/categories.fixture';

describe('apps/client/studio: /admin/categories', () => {
  it('has the categories loaded before the page first renders', async () => {
    await renderCategories([adminCategory({ name: 'Music' })]);

    expect(screen.getByText('Music')).toBeInTheDocument();
  });
});

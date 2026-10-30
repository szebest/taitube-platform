import { screen } from '@testing-library/react';

import { adminSection } from '#app/features/admin/components/__tests__/categories.fixture';

describe('apps/client/studio: /admin/moderation', () => {
  it('stands in until the page is built', async () => {
    await adminSection('/admin/moderation');

    expect(screen.getByText('Moderation is not available yet')).toBeInTheDocument();
  });
});

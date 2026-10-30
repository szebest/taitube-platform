import { screen } from '@testing-library/react';

import { adminSection } from '#app/features/admin/components/__tests__/categories.fixture';

describe('apps/client/studio: /admin/queues', () => {
  it('stands in until the page is built', async () => {
    await adminSection('/admin/queues');

    expect(screen.getByText('Queue health is not available yet')).toBeInTheDocument();
  });
});

import { adminSection } from '#app/features/admin/components/__tests__/categories.fixture';

describe('apps/client/studio: /admin', () => {
  it('opens the categories', async () => {
    const { router } = await adminSection('/admin');

    expect(router.state.location.pathname).toBe('/admin/categories');
  });
});

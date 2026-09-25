import { recordRequests } from '#app/__tests__/api-store';
import { serverRender } from '#app/__tests__/server-render';

describe('apps/web: /subscriptions', () => {
  it('serves the subscriptions page behind the members-only layout', async () => {
    recordRequests();

    const { status, main } = await serverRender('/subscriptions');

    expect(status).toBe(200);
    expect(main).not.toContain('Your subsciptions:');
  });
});

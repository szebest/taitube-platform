import { recordRequests } from '#app/__tests__/api-store';
import { serverRender } from '#app/__tests__/server-render';

describe('apps/web: /subscriptions/videos', () => {
  it('serves the subscription feed behind the members-only layout', async () => {
    recordRequests();

    const { status, main } = await serverRender('/subscriptions/videos');

    expect(status).toBe(200);
    expect(main).not.toContain('Subscription videos:');
  });
});

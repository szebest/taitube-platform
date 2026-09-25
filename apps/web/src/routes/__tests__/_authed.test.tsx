import { recordRequests } from '#app/__tests__/api-store';
import { serverRender } from '#app/__tests__/server-render';

describe('apps/web: members-only layout', () => {
  it('keeps the page area empty for a guest, whose token the server cannot see', async () => {
    recordRequests();

    const { status, main } = await serverRender('/subscriptions/videos');

    expect(status).toBe(200);
    expect(main).toContain('<main>');
    expect(main).not.toContain('<h3>');
  });
});

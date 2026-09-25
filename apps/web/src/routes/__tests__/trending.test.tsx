import { recordRequests } from '../../__tests__/api-store';
import { serverRender } from '../../__tests__/server-render';

describe('apps/web: /trending', () => {
  it('server-renders the legacy trending page inside the layout', async () => {
    recordRequests();

    const { status, main } = await serverRender('/trending');

    expect(status).toBe(200);
    expect(main).toContain('Trending videos:');
  });
});

import { recordRequests } from '../../__tests__/api-store';
import { serverRender } from '../../__tests__/server-render';

describe('apps/web: /', () => {
  it('server-renders the legacy all-videos page inside the layout', async () => {
    recordRequests();

    const { status, main } = await serverRender('/');

    expect(status).toBe(200);
    expect(main).toContain('All videos:');
  });
});

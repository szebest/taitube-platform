import { loaderApi } from '#app/__tests__/loader-api';
import { serverRender } from '#app/__tests__/server-render';

describe('apps/client/web: /trending', () => {
  it('server-renders the trending videos the loader fetched inside the layout', async () => {
    const { status, main } = await serverRender('/trending', { handlers: loaderApi() });

    expect(status).toBe(200);
    expect(main).toContain('Trending videos:');
    expect(main).toContain('Feed video');
  });
});

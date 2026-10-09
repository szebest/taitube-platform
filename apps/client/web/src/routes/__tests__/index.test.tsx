import { loaderApi } from '#app/__tests__/loader-api';
import { serverRender } from '#app/__tests__/server-render';

describe('apps/web: /', () => {
  it('server-renders the newest videos the loader fetched inside the layout', async () => {
    const answered: string[] = [];

    const { status, main } = await serverRender('/', { handlers: loaderApi(answered) });

    expect(status).toBe(200);
    expect(main).toContain('All videos:');
    expect(main).toContain('Feed video');
    expect(answered.sort()).toEqual(['/v1/categories', '/v1/feed']);
  });
});

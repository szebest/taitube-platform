import { serverRender } from '#app/__tests__/server-render';

describe('apps/web: /upload', () => {
  it('narrows the layout to the upload form width', async () => {
    const { status, main } = await serverRender('/upload');

    expect(status).toBe(200);
    expect(main).toContain('max-width:1280px');
  });
});

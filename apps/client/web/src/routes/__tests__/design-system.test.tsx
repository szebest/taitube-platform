import { serverRender } from '#app/__tests__/server-render';

describe('apps/client/web: /design-system', () => {
  it('server-renders the showcase on the dev server', async () => {
    const { status, html } = await serverRender('/design-system');

    expect(status).toBe(200);
    expect(html).toContain('<title>Design system - Taitube</title>');
  });
});

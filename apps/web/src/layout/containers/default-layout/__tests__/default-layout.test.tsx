import { stubBrowser } from '#app/__tests__/browser';
import { inChrome, renderPage } from '#app/__tests__/render-page';
import { DefaultLayout } from '../default-layout';

describe('apps/web: default layout', () => {
  it('frames the page with the header and the sidebar', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<DefaultLayout />));

    expect(markup).toContain('aria-label="theme switch"');
    expect(markup).toContain('href="/trending"');
  });

  it('server-renders the page area, so the HTML carries the page', async () => {
    stubBrowser();

    expect(await renderPage(inChrome(<DefaultLayout />))).toContain('<main');
  });
});

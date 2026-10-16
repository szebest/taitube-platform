import { stubBrowser } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders, inChrome } from '#app/__tests__/providers';
import { DefaultLayout } from '../default-layout';

describe('apps/client/web: default layout', () => {
  it('frames the page with the header and the sidebar', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<DefaultLayout />), AppProviders);

    expect(markup).toContain('aria-label="Theme: Dark"');
    expect(markup).toContain('href="/trending"');
  });

  it('server-renders the page area, so the HTML carries the page', async () => {
    stubBrowser();

    expect(await renderPage(inChrome(<DefaultLayout />), AppProviders)).toContain('<main');
  });
});

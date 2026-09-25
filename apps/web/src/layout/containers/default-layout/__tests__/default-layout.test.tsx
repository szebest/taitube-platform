import { stubBrowser } from '../../../../__tests__/browser';
import { inChrome, renderPage } from '../../../../__tests__/render-page';
import { DefaultLayout } from '../default-layout';

describe('apps/web: default layout', () => {
  it('frames the page with the header and the sidebar', () => {
    stubBrowser();

    const markup = renderPage(inChrome(<DefaultLayout />));

    expect(markup).toContain('aria-label="theme switch"');
    expect(markup).toContain('href="/trending"');
  });

  it('holds the page back until the sidebar has reported which breakpoint it is at', () => {
    stubBrowser();

    expect(renderPage(inChrome(<DefaultLayout />))).not.toContain('<main');
  });
});

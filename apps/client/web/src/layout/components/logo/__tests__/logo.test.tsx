import { stubBrowser } from '@vp/web-testing';
import { inChrome, renderPage } from '#app/__tests__/render-page';
import { Logo } from '../logo';

describe('apps/client/web: logo', () => {
  it('links home and offers the sidebar toggle', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<Logo hideLogoPart={false} />));

    expect(markup).toContain('href="/"');
    expect(markup).toContain('aria-label="Taitube"');
    expect(markup).toContain('aria-label="toggle sidebar"');
  });
});

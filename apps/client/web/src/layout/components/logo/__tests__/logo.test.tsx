import { stubBrowser } from '@vp/web-testing';
import { renderPage } from '@vp/web-testing/server';

import { AppProviders, inChrome } from '#app/__tests__/providers';
import { Logo } from '../logo';

describe('apps/client/web: logo', () => {
  it('links home and offers the sidebar toggle', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<Logo hideLogoPart={false} />), AppProviders);

    expect(markup).toContain('href="/"');
    expect(markup).toContain('aria-label="Taitube"');
    expect(markup).toContain('aria-label="toggle sidebar"');
  });
});

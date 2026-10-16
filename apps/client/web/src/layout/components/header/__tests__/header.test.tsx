import { stubBrowser } from '@vp/web-testing';

import { renderPage } from '@vp/web-testing/server';

import { AppProviders, inChrome, signedIn } from '#app/__tests__/providers';
import { Header } from '../header';

describe('apps/client/web: header', () => {
  it.each([
    { theme: 'dark', name: 'Theme: Dark' },
    { theme: 'light', name: 'Theme: Light' },
    { theme: 'system', name: 'Theme: System' },
  ] as const)(
    'server-renders the theme control for the $theme choice the server read',
    async ({ theme, name }) => {
      stubBrowser();

      expect(await renderPage(inChrome(<Header />, theme), AppProviders)).toContain(
        `aria-label="${name}"`
      );
    }
  );

  it('shows a guest the logo and no account menu', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<Header />), AppProviders);

    expect(markup).toContain('toggle sidebar');
    expect(markup).not.toContain('The Creator');
  });

  it('shows a signed-in viewer their channel', async () => {
    stubBrowser();

    expect(await renderPage(inChrome(<Header />), signedIn())).toContain('The Creator');
  });
});

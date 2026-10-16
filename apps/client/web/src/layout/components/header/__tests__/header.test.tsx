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

  it.each([
    { viewer: 'a guest', Providers: AppProviders, shown: '>Sign in</a>', hidden: 'The Creator' },
    {
      viewer: 'a signed-in viewer',
      Providers: signedIn(),
      shown: 'The Creator',
      hidden: 'Sign in',
    },
  ])('shows $viewer the logo and their account', async ({ Providers, shown, hidden }) => {
    stubBrowser();

    const markup = await renderPage(inChrome(<Header />), Providers);

    expect(markup).toContain('toggle sidebar');
    expect(markup).toContain(shown);
    expect(markup).not.toContain(hidden);
  });
});

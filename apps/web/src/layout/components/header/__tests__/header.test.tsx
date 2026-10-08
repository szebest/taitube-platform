import { createApiStore } from '#app/__tests__/api-store';
import { stubBrowser } from '#app/__tests__/browser';
import { account } from '#app/__tests__/fixtures';
import { inChrome, renderPage, signIn } from '#app/__tests__/render-page';
import { Header } from '../header';

describe('apps/web: header', () => {
  it('holds back the controls while the account is loading', async () => {
    stubBrowser({ token: 'signed-in' });

    const markup = await renderPage(inChrome(<Header />));

    expect(markup).not.toContain('aria-label="Theme:');
    expect(markup).not.toContain('toggle sidebar');
  });

  it.each([
    { theme: 'dark', name: 'Theme: Dark' },
    { theme: 'light', name: 'Theme: Light' },
    { theme: 'system', name: 'Theme: System' },
  ] as const)(
    'server-renders the theme control for the $theme choice the server read',
    async ({ theme, name }) => {
      stubBrowser();

      expect(await renderPage(inChrome(<Header />, theme))).toContain(`aria-label="${name}"`);
    }
  );

  it('shows a guest the logo and no account menu', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<Header />));

    expect(markup).toContain('toggle sidebar');
    expect(markup).not.toContain('The Creator');
  });

  it('shows a signed-in viewer their channel', async () => {
    const store = createApiStore();
    await signIn(store, account());

    expect(await renderPage(inChrome(<Header />), { store })).toContain('The Creator');
  });
});

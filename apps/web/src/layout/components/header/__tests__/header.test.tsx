import { createApiStore } from '#app/__tests__/api-store';
import { stubBrowser } from '#app/__tests__/browser';
import { account } from '#app/__tests__/fixtures';
import { inChrome, renderPage, signIn } from '#app/__tests__/render-page';
import { Header } from '../header';

describe('apps/web: header', () => {
  it('holds back the controls while the account is loading', async () => {
    stubBrowser({ token: 'signed-in' });

    const markup = await renderPage(inChrome(<Header />));

    expect(markup).not.toContain('theme switch');
    expect(markup).not.toContain('toggle sidebar');
  });

  it.each([
    { theme: 'dark', checked: true },
    { theme: 'light', checked: false },
  ] as const)(
    'server-renders the switch for the $theme theme the server read',
    async ({ theme, checked }) => {
      stubBrowser();

      const markup = await renderPage(inChrome(<Header />, theme));

      expect(markup).toContain('aria-label="theme switch"');
      expect(markup).toContain(`>${theme}</label>`);
      expect(markup.includes('checked=""')).toBe(checked);
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

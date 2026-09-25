import { createApiStore } from '../../../../__tests__/api-store';
import { stubBrowser } from '../../../../__tests__/browser';
import { account } from '../../../../__tests__/fixtures';
import { inChrome, renderPage, signIn } from '../../../../__tests__/render-page';
import { Header } from '../header';

describe('apps/web: header', () => {
  it('holds back the controls while the account is loading', async () => {
    stubBrowser({ token: 'signed-in' });

    const markup = await renderPage(inChrome(<Header />));

    expect(markup).not.toContain('theme switch');
    expect(markup).not.toContain('toggle sidebar');
  });

  it('server-renders the theme switch off, showing light, whatever the viewer chose', async () => {
    stubBrowser({ prefersDark: true, stored: { THEME: '"dark"' } });

    const markup = await renderPage(inChrome(<Header />));

    expect(markup).toContain('aria-label="theme switch"');
    expect(markup).toContain('>light</label>');
    expect(markup).not.toContain('checked=""');
  });

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

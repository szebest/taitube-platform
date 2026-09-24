import { createApiStore } from '../../../../__tests__/api-store';
import { stubBrowser } from '../../../../__tests__/browser';
import { account } from '../../../../__tests__/fixtures';
import { inChrome, renderPage, signIn } from '../../../../__tests__/render-page';
import { clearStoredValues, storeValue } from '../../../../__tests__/stored-value';
import { Header } from '../header';

vi.mock(import('@uidotdev/usehooks'), async (importOriginal) => ({
  ...(await importOriginal()),
  useLocalStorage: (await import('../../../../__tests__/stored-value')).useStoredValue,
}));

describe('apps/web: header', () => {
  beforeEach(() => {
    clearStoredValues();
  });

  it('holds back the controls while the account is loading', () => {
    stubBrowser({ token: 'signed-in' });

    const markup = renderPage(inChrome(<Header />));

    expect(markup).not.toContain('theme switch');
    expect(markup).not.toContain('toggle sidebar');
  });

  it.each([
    { theme: 'light', checked: false },
    { theme: 'dark', checked: true },
  ])('offers the theme switch, on for dark, showing $theme', ({ theme, checked }) => {
    stubBrowser();
    storeValue('THEME', theme);

    const markup = renderPage(inChrome(<Header />));

    expect(markup).toContain('aria-label="theme switch"');
    expect(markup).toContain(`>${theme}</label>`);
    expect(markup.includes('checked=""')).toBe(checked);
  });

  it('shows a guest the logo and no account menu', () => {
    stubBrowser();

    const markup = renderPage(inChrome(<Header />));

    expect(markup).toContain('toggle sidebar');
    expect(markup).not.toContain('The Creator');
  });

  it('shows a signed-in viewer their channel', async () => {
    const store = createApiStore();
    await signIn(store, account());

    expect(renderPage(inChrome(<Header />), { store })).toContain('The Creator');
  });
});

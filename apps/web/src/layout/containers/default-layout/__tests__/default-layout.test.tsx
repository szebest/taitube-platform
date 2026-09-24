import { stubBrowser } from '../../../../__tests__/browser';
import { inChrome, renderPage } from '../../../../__tests__/render-page';
import { clearStoredValues } from '../../../../__tests__/stored-value';
import { DefaultLayout } from '../default-layout';

vi.mock(import('@uidotdev/usehooks'), async (importOriginal) => ({
  ...(await importOriginal()),
  useLocalStorage: (await import('../../../../__tests__/stored-value')).useStoredValue,
}));

describe('apps/web: default layout', () => {
  beforeEach(() => {
    clearStoredValues();
  });

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

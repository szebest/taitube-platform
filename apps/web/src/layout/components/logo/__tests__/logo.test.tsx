import { stubBrowser } from '../../../../__tests__/browser';
import { inChrome, renderPage } from '../../../../__tests__/render-page';
import { Logo } from '../logo';

describe('apps/web: logo', () => {
  it('links home and offers the sidebar toggle', async () => {
    stubBrowser();

    const markup = await renderPage(inChrome(<Logo hideLogoPart={false} />));

    expect(markup).toContain('href="/"');
    expect(markup).toContain('<title>Taitube</title>');
    expect(markup).toContain('aria-label="toggle sidebar"');
  });

  it.each([
    { hideLogoPart: true, shape: 'logo__short' },
    { hideLogoPart: false, shape: 'logo__long' },
  ])('draws the $shape logo when hideLogoPart=$hideLogoPart', async ({ hideLogoPart, shape }) => {
    stubBrowser();

    expect(await renderPage(inChrome(<Logo hideLogoPart={hideLogoPart} />))).toContain(shape);
  });
});

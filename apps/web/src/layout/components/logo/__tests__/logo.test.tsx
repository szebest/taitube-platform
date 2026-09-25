import { inChrome, renderPage } from '../../../../__tests__/render-page';
import { stubBrowser } from '../../../../__tests__/browser';
import { Logo } from '../logo';

describe('apps/web: logo', () => {
  it('links home and offers the sidebar toggle', () => {
    stubBrowser();

    const markup = renderPage(inChrome(<Logo hideLogoPart={false} />));

    expect(markup).toContain('href="/"');
    expect(markup).toContain('<title>Taitube</title>');
    expect(markup).toContain('aria-label="toggle sidebar"');
  });

  it.each([
    { hideLogoPart: true, shape: 'logo__short' },
    { hideLogoPart: false, shape: 'logo__long' },
  ])('draws the $shape logo when hideLogoPart=$hideLogoPart', ({ hideLogoPart, shape }) => {
    stubBrowser();

    expect(renderPage(inChrome(<Logo hideLogoPart={hideLogoPart} />))).toContain(shape);
  });
});

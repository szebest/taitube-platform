import { screen, within } from '@testing-library/react';
import { writeCookie } from '@vp/ui';

import { renderShell } from './render-shell';

afterEach(() => writeCookie('vp.sidebar', '', { maxAge: 0 }));

function setViewportWide(wide: boolean) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: wide,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as MediaQueryList);
}

describe('apps/client/web: root shell', () => {
  it('collapses and expands the rail from the menu button and keeps the choice in a cookie', async () => {
    setViewportWide(true);
    const { user } = await renderShell('/', false);
    const menu = screen.getByRole('button', { name: 'Menu' });

    await user.click(menu);

    expect(menu).toHaveAttribute('aria-expanded', 'false');
    expect(document.cookie).toContain('vp.sidebar=collapsed');

    await user.click(menu);

    expect(menu).toHaveAttribute('aria-expanded', 'true');
    expect(document.cookie).toContain('vp.sidebar=expanded');
  });

  it('opens the rail in a drawer from the menu button where the rail does not fit, and closes it on a link', async () => {
    setViewportWide(false);
    const { user } = await renderShell('/', false);

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    const drawer = screen.getByRole('dialog');
    await user.click(within(drawer).getByRole('link', { name: 'Trending' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

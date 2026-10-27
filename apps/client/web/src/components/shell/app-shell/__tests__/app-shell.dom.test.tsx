import { render, screen, within } from '@testing-library/react';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { AppShell, AppShellSkeleton } from '..';
import type { AppShellRootProps } from '../app-shell';

const renderShell = (props: Partial<AppShellRootProps> = {}) =>
  render(
    <AppProviders>
      <AppShell.Root railState="open" onRailStateChange={vi.fn()} {...props}>
        <AppShell.Header logo={<a href="/">Taitube</a>} search={<input aria-label="Search" />} />
        <AppShell.Rail>
          <AppShell.Group>
            <AppShell.Item icon="home" href="/" active>
              Home
            </AppShell.Item>
            <AppShell.Item icon="video" href="/studio" labelled>
              Your videos
            </AppShell.Item>
          </AppShell.Group>
        </AppShell.Rail>
        <AppShell.Main>Page</AppShell.Main>
        <AppShell.TabBar>
          <AppShell.TabItem icon="home" href="/" active>
            Home
          </AppShell.TabItem>
        </AppShell.TabBar>
      </AppShell.Root>
    </AppProviders>
  );

describe('apps/client/web: AppShell', () => {
  it('puts the skip link first and lands it on the main landmark', () => {
    renderShell();

    const skip = screen.getByRole('link', { name: 'Skip to content' });

    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(document.body.querySelector('a')).toBe(skip);
  });

  it('marks the active item as the current page, with its icon beside the label', () => {
    renderShell();
    const rail = screen.getAllByRole('navigation', { name: 'Main' })[0] as HTMLElement;

    const home = within(rail).getByRole('link', { name: 'Home' });

    expect(home).toHaveAttribute('aria-current', 'page');
    expect(home.querySelector('[data-icon="home"]')).toBeInTheDocument();
    expect(within(rail).getByRole('link', { name: 'Your videos' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('asks for the opposite rail state when the menu is pressed on a wide screen', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    } as unknown as MediaQueryList);
    const onRailStateChange = vi.fn();
    renderShell({ onRailStateChange });

    screen.getByRole('button', { name: 'Menu' }).click();

    expect(onRailStateChange).toHaveBeenCalledWith('collapsed');
  });

  it('tells the immersive variant apart, for the chrome it hides', () => {
    renderShell({ variant: 'immersive' });

    expect(document.querySelector('[data-slot="app-shell"]')).toHaveAttribute(
      'data-variant',
      'immersive'
    );
  });

  it('passes axe, loaded and as a skeleton', async () => {
    renderShell();
    render(<AppShellSkeleton />);

    expect(await axeViolations()).toEqual([]);
  });
});

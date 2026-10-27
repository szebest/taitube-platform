import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axeViolations } from '@vp/web-testing/dom';

import { AppProviders } from '#app/__tests__/providers';
import { AppShell, AppShellSkeleton } from '..';
import type { AppShellRootProps } from '../app-shell';

const WIDTHS: Record<'large' | 'expanded' | 'medium', string[]> = {
  large: ['(min-width: 1440px)', '(min-width: 1024px)'],
  expanded: ['(min-width: 1024px)'],
  medium: [],
};

function setViewport(width: keyof typeof WIDTHS) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: WIDTHS[width].includes(query),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList
  );
}

const renderShell = (props: Partial<AppShellRootProps> = {}) => {
  const user = userEvent.setup();
  render(
    <AppProviders>
      <AppShell.Root railState="open" onRailStateChange={vi.fn()} {...props}>
        <AppShell.Header
          logo={<a href="/">Taitube</a>}
          search={<AppShell.SearchTrigger>Search</AppShell.SearchTrigger>}
        />
        <AppShell.Rail>
          <AppShell.Group>
            <AppShell.Item icon="home" href="/" active>
              <AppShell.Label>Home</AppShell.Label>
            </AppShell.Item>
            <AppShell.Item icon="video" href="/studio" labelled>
              <AppShell.Label>Your videos</AppShell.Label>
            </AppShell.Item>
          </AppShell.Group>
        </AppShell.Rail>
        <AppShell.Main>Page</AppShell.Main>
        <AppShell.NowPlaying>
          <p>Lisbon at night</p>
        </AppShell.NowPlaying>
        <AppShell.TabBar>
          <AppShell.TabItem icon="home" href="/" active>
            Home
          </AppShell.TabItem>
        </AppShell.TabBar>
      </AppShell.Root>
    </AppProviders>
  );
  return { user, menu: screen.getByRole('button', { name: 'Menu' }) };
};

const rail = () => document.querySelector<HTMLElement>('[data-slot="app-shell-rail"]');

describe('apps/client/web: AppShell', () => {
  it('puts the skip link first, then the header, rail, main, now playing and tab bar', () => {
    renderShell();

    const skip = screen.getByRole('link', { name: 'Skip to content' });
    const order = [
      ...document.querySelectorAll(
        '[data-slot="app-shell"] > :is(a, header, nav, main, [data-slot="app-shell-now-playing"])'
      ),
    ].map((element) => element.getAttribute('data-slot'));

    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(document.body.querySelector('a')).toBe(skip);
    expect(order).toEqual([
      'app-shell-skip-link',
      'app-shell-header',
      'app-shell-rail',
      'app-shell-main',
      'app-shell-now-playing',
      'app-shell-tab-bar',
    ]);
  });

  it('marks the active item as the current page, with its icon beside the label', () => {
    renderShell();
    const [navigation] = screen.getAllByRole('navigation', { name: 'Main' });

    const home = within(navigation as HTMLElement).getByRole('link', { name: 'Home' });

    expect(home).toHaveAttribute('aria-current', 'page');
    expect(home.querySelector('[data-icon="home"]')).toBeInTheDocument();
    expect(
      within(navigation as HTMLElement).getByRole('link', { name: 'Your videos' })
    ).not.toHaveAttribute('aria-current');
  });

  it('opens the field-shaped search trigger as a dialog, with its shortcuts named', () => {
    renderShell();

    const search = screen.getByRole('button', { name: 'Search' });

    expect(search).toHaveAttribute('aria-haspopup', 'dialog');
    expect(search).toHaveAttribute('aria-keyshortcuts', '/ Control+K Meta+K');
  });

  it.each([
    { width: 'large', railState: 'open', shown: false },
    { width: 'large', railState: 'collapsed', shown: true },
    { width: 'expanded', railState: 'open', shown: true },
  ] as const)(
    'shows a rail item its name in a tooltip only where the rail shows icons alone ($width, $railState)',
    ({ width, railState, shown }) => {
      setViewport(width);
      renderShell({ railState });

      act(() =>
        within(rail() as HTMLElement)
          .getByRole('link', { name: 'Home' })
          .focus()
      );

      expect(screen.queryByRole('tooltip', { name: 'Home' }) !== null).toBe(shown);
    }
  );

  it('draws a divider under the header once the page scrolls', () => {
    renderShell();
    const header = screen.getByRole('banner');

    expect(header).not.toHaveAttribute('data-scrolled');

    act(() => {
      window.scrollY = 120;
      fireEvent.scroll(window);
    });

    expect(header).toHaveAttribute('data-scrolled');
    window.scrollY = 0;
  });

  it('asks for the opposite rail state when the menu is pressed on a large screen', async () => {
    setViewport('large');
    const onRailStateChange = vi.fn();
    const { user, menu } = renderShell({ onRailStateChange });

    await user.click(menu);

    expect(menu).toHaveAttribute('aria-controls', rail()?.id);
    expect(onRailStateChange).toHaveBeenCalledWith('collapsed');
  });

  it.each([
    { label: 'Escape', close: () => fireEvent.keyDown(document, { key: 'Escape' }) },
    { label: 'a press outside', close: () => fireEvent.pointerDown(screen.getByRole('main')) },
    { label: 'the menu again', close: () => screen.getByRole('button', { name: 'Menu' }).click() },
  ])(
    'opens the rail over the content between expanded and large, and closes it on $label',
    async ({ close }) => {
      setViewport('expanded');
      const onRailStateChange = vi.fn();
      const { user, menu } = renderShell({ onRailStateChange });

      await user.click(menu);

      expect(menu).toHaveAttribute('aria-controls', rail()?.id);
      expect(menu).toHaveAttribute('aria-expanded', 'true');
      expect(rail()).toHaveAttribute('data-labels', 'shown');

      act(close);

      expect(menu).toHaveAttribute('aria-expanded', 'false');
      expect(rail()).not.toHaveAttribute('data-labels');
      expect(onRailStateChange).not.toHaveBeenCalled();
    }
  );

  it('opens the drawer below expanded, and the menu controls the drawer', async () => {
    setViewport('medium');
    const { user, menu } = renderShell();

    await user.click(menu);
    const drawer = screen.getByRole('dialog');

    expect(menu).toHaveAttribute('aria-controls', drawer.id);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
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

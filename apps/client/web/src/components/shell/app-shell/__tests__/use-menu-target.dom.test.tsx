import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AppShellContext } from '../app-shell.context';
import { useMenuTarget } from '../use-menu-target';

const WIDTHS = {
  large: ['(min-width: 1440px)', '(min-width: 1024px)'],
  expanded: ['(min-width: 1024px)'],
  medium: [] as string[],
};

function renderTarget(width: keyof typeof WIDTHS, railState: 'open' | 'collapsed' = 'open') {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: WIDTHS[width].includes(query),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList
  );
  const actions = { setRailState: vi.fn(), setRailOverlay: vi.fn(), setDrawerOpen: vi.fn() };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppShellContext
      value={{
        variant: 'default',
        railState,
        railId: 'rail',
        drawerId: 'drawer',
        drawerOpen: false,
        railOverlay: false,
        ...actions,
      }}
    >
      {children}
    </AppShellContext>
  );
  return { ...renderHook(() => useMenuTarget(), { wrapper }), ...actions };
}

describe('apps/client/web: useMenuTarget', () => {
  it.each([
    { width: 'large', controls: 'rail', expanded: true, called: 'setRailState', with: 'collapsed' },
    { width: 'expanded', controls: 'rail', expanded: false, called: 'setRailOverlay', with: true },
    { width: 'medium', controls: 'drawer', expanded: false, called: 'setDrawerOpen', with: true },
  ] as const)(
    'points the menu at $controls at $width and toggles through $called',
    ({ width, controls, expanded, called, with: argument }) => {
      const { result, ...actions } = renderTarget(width);

      result.current.toggle();

      expect(result.current.controls).toBe(controls);
      expect(result.current.expanded).toBe(expanded);
      expect(actions[called]).toHaveBeenCalledWith(argument);
    }
  );

  it('asks to open a collapsed rail on a large screen', () => {
    const { result, setRailState } = renderTarget('large', 'collapsed');

    result.current.toggle();

    expect(setRailState).toHaveBeenCalledWith('open');
  });
});

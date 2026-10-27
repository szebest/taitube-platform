import { fireEvent, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AppShellContext } from '../app-shell.context';
import { useRailOverlay } from '../use-rail-overlay';

function renderOverlay(railOverlay: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(min-width: 1024px)',
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList
  );
  const nav = document.createElement('nav');
  document.body.append(nav);
  const setRailOverlay = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppShellContext
      value={{
        variant: 'default',
        railState: 'open',
        railId: 'rail',
        drawerId: 'drawer',
        drawerOpen: false,
        railOverlay,
        setRailState: vi.fn(),
        setDrawerOpen: vi.fn(),
        setRailOverlay,
      }}
    >
      {children}
    </AppShellContext>
  );
  const hook = renderHook(() => useRailOverlay({ current: nav }), { wrapper });
  return { ...hook, nav, setRailOverlay };
}

describe('apps/client/web: useRailOverlay', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is an overlay only while the rail is open over the content', () => {
    expect(renderOverlay(true).result.current.overlay).toBe(true);
    expect(renderOverlay(false).result.current.overlay).toBe(false);
  });

  it('closes on Escape and on a press outside the rail, not on a press inside it', () => {
    const { nav, setRailOverlay } = renderOverlay(true);

    fireEvent.pointerDown(nav);
    expect(setRailOverlay).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(document.body);

    expect(setRailOverlay).toHaveBeenCalledTimes(2);
    expect(setRailOverlay).toHaveBeenCalledWith(false);
  });

  it('listens to nothing while the rail is not an overlay', () => {
    const { setRailOverlay } = renderOverlay(false);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(setRailOverlay).not.toHaveBeenCalled();
  });
});

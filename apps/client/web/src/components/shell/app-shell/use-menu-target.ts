import { useMediaQuery } from '@vp/ui';
import { useAppShell } from './app-shell.context';

export const RAIL_OPENS_IN_PLACE = '(min-width: 1440px)';
export const RAIL_OPENS_OVER = '(min-width: 1024px)';

/** What the menu button opens at this width: the rail in place, the rail over the content, or the drawer. */
export function useMenuTarget() {
  const {
    railState,
    setRailState,
    railId,
    drawerId,
    drawerOpen,
    setDrawerOpen,
    railOverlay,
    setRailOverlay,
  } = useAppShell('Header');
  const opensInPlace = useMediaQuery(RAIL_OPENS_IN_PLACE);
  const opensOver = useMediaQuery(RAIL_OPENS_OVER);

  if (opensInPlace) {
    return {
      controls: railId,
      expanded: railState === 'open',
      toggle: () => setRailState(railState === 'open' ? 'collapsed' : 'open'),
    };
  }
  if (opensOver) {
    return { controls: railId, expanded: railOverlay, toggle: () => setRailOverlay(!railOverlay) };
  }
  return { controls: drawerId, expanded: drawerOpen, toggle: () => setDrawerOpen(true) };
}

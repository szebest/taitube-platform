import { useMediaQuery } from '@vp/ui';
import { useEffect, useEffectEvent } from 'react';
import { useAppShell } from './app-shell.context';
import { RAIL_OPENS_IN_PLACE, RAIL_OPENS_OVER } from './use-menu-target';

export function useRailOverlay(navRef: { current: HTMLElement | null }) {
  const { railId, railOverlay, setRailOverlay } = useAppShell('Rail');
  const opensInPlace = useMediaQuery(RAIL_OPENS_IN_PLACE);
  const opensOver = useMediaQuery(RAIL_OPENS_OVER);
  const overlay = railOverlay && opensOver && !opensInPlace;
  const close = useEffectEvent(() => setRailOverlay(false));

  useEffect(() => {
    if (!overlay) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || navRef.current?.contains(target)) {
        return;
      }
      if (target.closest(`[aria-controls="${railId}"]`)) {
        return;
      }
      close();
    };

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    const stopListening = () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
    };
    return stopListening;
  }, [overlay, railId, navRef]);

  return { overlay, opensInPlace };
}

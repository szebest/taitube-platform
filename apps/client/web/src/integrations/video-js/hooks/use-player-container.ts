import { useContainer } from '@videojs/react';

/** The element that goes fullscreen: a menu portals into it, or fullscreen hides the menu. */
export function usePlayerContainer(): HTMLElement | null {
  return useContainer();
}

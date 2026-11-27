import { shouldPrefetch } from '#app/integrations/network/should-prefetch';
import { usePlaybackPreference } from '#app/lib/preferences/device-preferences-provider';
import { useReducedMotion } from './use-reduced-motion';

/** Whether a card plays its frames on hover: the `hoverPlay` setting, never under save-data, on 2g or with reduced motion. */
export function useHoverPlay(): boolean {
  const [hoverPlay] = usePlaybackPreference('hoverPlay');
  const reducedMotion = useReducedMotion();

  return hoverPlay && !reducedMotion && shouldPrefetch();
}

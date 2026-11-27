import { useRootAttribute } from './use-root-attribute';

/** Whether the viewer is on the `reduced` motion set, which the root element carries as `data-motion`. */
export function useReducedMotion(): boolean {
  return useRootAttribute('motion') === 'reduced';
}

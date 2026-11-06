import { useRouterState } from '@tanstack/react-router';

/** Whether the viewer is on a watch page, where the stage shows the player and the bar steps aside. */
export function useIsWatching(): boolean {
  return useRouterState({ select: ({ location }) => location.pathname.startsWith('/watch/') });
}

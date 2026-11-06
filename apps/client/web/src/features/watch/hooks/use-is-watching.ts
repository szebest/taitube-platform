import { useRouterState } from '@tanstack/react-router';

const OWN_PLAYER = /^\/(clip|live|shorts)\//;

function useCommittedPathname(): string {
  return useRouterState({ select: ({ matches }) => matches.at(-1)?.pathname ?? '' });
}

/** Whether the viewer is on a watch page, where the stage shows the player and the bar steps aside. It follows the page on screen, not the one loading, so the player is never left without a slot. */
export function useIsWatching(): boolean {
  return useCommittedPathname().startsWith('/watch/');
}

/** Whether the page on screen plays its own video, so the session player has to stay quiet. */
export function useOwnsPlayer(): boolean {
  return OWN_PLAYER.test(useCommittedPathname());
}

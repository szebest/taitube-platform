import { useLocation } from '@tanstack/react-router';
import type { ShellTarget } from '#app/hooks/use-shell-destinations';

function pathOf(target: ShellTarget): string | undefined {
  switch (target.kind) {
    case 'page':
      return target.to;
    case 'channel':
      return `/channel/${target.channelId}`;
    case 'studio':
      return undefined;
  }
}

/** The destination the viewer is on, so the shell can mark it `aria-current="page"`; a channel's subpages count. */
export function useIsCurrent(): (target: ShellTarget) => boolean {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (target) => {
    const path = pathOf(target);
    if (path === undefined) {
      return false;
    }
    return pathname === path || (target.kind === 'channel' && pathname.startsWith(`${path}/`));
  };
}

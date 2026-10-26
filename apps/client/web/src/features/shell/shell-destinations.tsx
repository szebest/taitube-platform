import { Link, useLocation } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import { assertNever } from '@vp/result';
import type { IconId } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

import { STUDIO_URL } from '#app/config';

export type ShellTarget =
  | { kind: 'page'; to: '/' | '/feed/trending' | '/subscriptions/videos' }
  | { kind: 'channel'; channelId: string }
  | { kind: 'studio' };

export type ShellDestination = {
  id: string;
  label: string;
  icon: IconId;
  target: ShellTarget;
  /** Offered in the compact tab bar, and in the collapsed rail; the rest only where labels fit. */
  compact: boolean;
};

export function useShellDestinations(): { main: ShellDestination[]; you: ShellDestination[] } {
  const account = useAccount();
  const { tOr } = useT();

  const home: ShellDestination = {
    id: 'home',
    label: tOr('shell.home', {}, ''),
    icon: 'home',
    target: { kind: 'page', to: '/' },
    compact: true,
  };
  const trending: ShellDestination = {
    id: 'trending',
    label: tOr('shell.trending', {}, ''),
    icon: 'flame',
    target: { kind: 'page', to: '/feed/trending' },
    compact: true,
  };

  if (!account) {
    return { main: [home, trending], you: [] };
  }

  const subscriptions: ShellDestination = {
    id: 'subscriptions',
    label: tOr('shell.subscriptions', {}, ''),
    icon: 'following',
    target: { kind: 'page', to: '/subscriptions/videos' },
    compact: true,
  };

  return {
    main: [home, subscriptions, trending],
    you: [
      {
        id: 'your-channel',
        label: tOr('shell.yourChannel', {}, ''),
        icon: 'you',
        target: { kind: 'channel', channelId: account.channel.id },
        compact: true,
      },
      {
        id: 'your-videos',
        label: tOr('shell.yourVideos', {}, ''),
        icon: 'video',
        target: { kind: 'studio' },
        compact: false,
      },
    ],
  };
}

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

/** The destination the viewer is on, so the shell can mark it `aria-current="page"`. */
export function useIsCurrent(): (target: ShellTarget) => boolean {
  const pathname = useLocation({ select: (location) => location.pathname });

  return (target) => pathOf(target) === pathname;
}

export type ShellDestinationLinkProps = Omit<ComponentPropsWithRef<'a'>, 'href'> & {
  destination: ShellTarget;
};

/** The router link to a shell destination, or the plain one out to the studio. */
export function ShellDestinationLink({ destination, ...props }: ShellDestinationLinkProps) {
  switch (destination.kind) {
    case 'page':
      return <Link to={destination.to} {...props} />;
    case 'channel':
      return (
        <Link to="/channel/$channelId" params={{ channelId: destination.channelId }} {...props} />
      );
    case 'studio':
      return <a href={STUDIO_URL} {...props} />;
    default:
      return assertNever(destination, 'shell target');
  }
}

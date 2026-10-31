import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import { assertNever } from '@vp/result';
import type { IconId } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

import { STUDIO_URL } from '#app/config';

export type ShellTarget =
  | {
      kind: 'page';
      to:
        | '/'
        | '/shorts'
        | '/feed/trending'
        | '/live'
        | '/subscriptions/videos'
        | '/feed/you'
        | '/feed/history';
    }
  | { kind: 'channel'; channelId: string }
  | { kind: 'studio' };

type ShellDestination = {
  id: string;
  label: string;
  icon: IconId;
  target: ShellTarget;
  /** Offered in the compact tab bar, and in the collapsed rail; the rest only where labels fit. */
  compact: boolean;
};

export interface ShellDestinations {
  main: ShellDestination[];
  /** The You group's items; the group's heading and the compact tab bar's You tab are `hub`. */
  you: ShellDestination[];
  hub?: ShellDestination;
}

export function useShellDestinations(): ShellDestinations {
  const account = useAccount();
  const { tOr } = useT();

  const home: ShellDestination = {
    id: 'home',
    label: tOr('shell.home', {}, ''),
    icon: 'home',
    target: { kind: 'page', to: '/' },
    compact: true,
  };
  const shorts: ShellDestination = {
    id: 'shorts',
    label: tOr('shell.shorts', {}, ''),
    icon: 'shorts',
    target: { kind: 'page', to: '/shorts' },
    compact: true,
  };
  const trending: ShellDestination = {
    id: 'trending',
    label: tOr('shell.trending', {}, ''),
    icon: 'flame',
    target: { kind: 'page', to: '/feed/trending' },
    compact: true,
  };

  const live: ShellDestination = {
    id: 'live',
    label: tOr('shell.live', {}, ''),
    icon: 'live',
    target: { kind: 'page', to: '/live' },
    compact: false,
  };

  if (!account) {
    return { main: [home, shorts, trending, live], you: [] };
  }

  const subscriptions: ShellDestination = {
    id: 'subscriptions',
    label: tOr('shell.subscriptions', {}, ''),
    icon: 'following',
    target: { kind: 'page', to: '/subscriptions/videos' },
    compact: true,
  };

  return {
    main: [home, shorts, subscriptions, trending, live],
    hub: {
      id: 'you',
      label: tOr('shell.you', {}, ''),
      icon: 'you',
      target: { kind: 'page', to: '/feed/you' },
      compact: true,
    },
    you: [
      {
        id: 'history',
        label: tOr('library.historyTitle', {}, ''),
        icon: 'history',
        target: { kind: 'page', to: '/feed/history' },
        compact: false,
      },
      {
        id: 'your-channel',
        label: tOr('shell.yourChannel', {}, ''),
        icon: 'you',
        target: { kind: 'channel', channelId: account.channel.id },
        compact: false,
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

/** Goes to a shell destination from code, as a palette action does. */
export function useOpenDestination(): (target: ShellTarget) => void {
  const navigate = useNavigate();

  return (target) => {
    switch (target.kind) {
      case 'page':
        navigate({ to: target.to });
        return;
      case 'channel':
        navigate({ to: '/channel/$channelId', params: { channelId: target.channelId } });
        return;
      case 'studio':
        window.location.assign(STUDIO_URL);
        return;
      default:
        assertNever(target, 'shell target');
    }
  };
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

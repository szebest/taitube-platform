import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import type { IconId } from '@vp/ui';

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
        | '/feed/history'
        | '/settings';
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

  const settings: ShellDestination = {
    id: 'settings',
    label: tOr('shell.settings', {}, ''),
    icon: 'settings',
    target: { kind: 'page', to: '/settings' },
    compact: false,
  };

  if (!account) {
    return { main: [home, shorts, trending, live, settings], you: [] };
  }

  const subscriptions: ShellDestination = {
    id: 'subscriptions',
    label: tOr('shell.subscriptions', {}, ''),
    icon: 'following',
    target: { kind: 'page', to: '/subscriptions/videos' },
    compact: true,
  };

  return {
    main: [home, shorts, subscriptions, trending, live, settings],
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

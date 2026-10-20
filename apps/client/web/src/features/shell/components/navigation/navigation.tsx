import { Link } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { useAccount } from '@vp/queries';
import { assertNever } from '@vp/result';
import { cn } from '@vp/ui';
import {
  Clapperboard,
  CircleUserRound,
  Flame,
  House,
  type LucideIcon,
  SquarePlay,
} from 'lucide-react';

import type { ReactNode } from 'react';

import { STUDIO_URL } from '#app/config';

type NavTarget =
  | { kind: 'page'; to: '/' | '/feed/trending' | '/subscriptions/videos' }
  | { kind: 'channel'; channelId: string }
  | { kind: 'studio' };

type NavItem = {
  id: string;
  label: string;
  onRail: boolean;
  icon: LucideIcon;
  target: NavTarget;
};

function useNavSections(): { main: NavItem[]; you: NavItem[] } {
  const account = useAccount();
  const { tOr } = useT();

  const home: NavItem = {
    id: 'home',
    label: tOr('shell.home', {}, ''),
    onRail: true,
    icon: House,
    target: { kind: 'page', to: '/' },
  };
  const trending: NavItem = {
    id: 'trending',
    label: tOr('shell.trending', {}, ''),
    onRail: true,
    icon: Flame,
    target: { kind: 'page', to: '/feed/trending' },
  };

  if (!account) {
    return { main: [home, trending], you: [] };
  }

  const subscriptions: NavItem = {
    id: 'subscriptions',
    label: tOr('shell.subscriptions', {}, ''),
    onRail: true,
    icon: SquarePlay,
    target: { kind: 'page', to: '/subscriptions/videos' },
  };

  return {
    main: [home, subscriptions, trending],
    you: [
      {
        id: 'your-channel',
        label: tOr('shell.yourChannel', {}, ''),
        onRail: true,
        icon: CircleUserRound,
        target: { kind: 'channel', channelId: account.channel.id },
      },
      {
        id: 'your-videos',
        label: tOr('shell.yourVideos', {}, ''),
        onRail: false,
        icon: Clapperboard,
        target: { kind: 'studio' },
      },
    ],
  };
}

type NavLinkProps = { target: NavTarget; className?: string; children: ReactNode };

const ACTIVE = { className: 'tw:bg-tint tw:font-medium' };

function NavLink({ target, className, children }: NavLinkProps) {
  switch (target.kind) {
    case 'page':
      return (
        <Link
          to={target.to}
          activeOptions={{ exact: true }}
          className={className}
          activeProps={ACTIVE}
        >
          {children}
        </Link>
      );
    case 'channel':
      return (
        <Link
          to="/channel/$channelId"
          params={{ channelId: target.channelId }}
          className={className}
          activeProps={ACTIVE}
        >
          {children}
        </Link>
      );
    case 'studio':
      return (
        <a href={STUDIO_URL} className={className}>
          {children}
        </a>
      );
    default:
      return assertNever(target, 'nav target');
  }
}

const ITEM =
  'tw:flex tw:items-center tw:rounded-lg tw:text-fg tw:no-underline tw:transition-colors tw:hover:bg-tint tw:focus-ring';
const RAIL_ITEM = 'tw:flex-col tw:gap-1 tw:px-1 tw:py-3 tw:text-xs';
const DRAWER_ITEM = 'tw:xl:flex-row tw:xl:gap-5 tw:xl:px-3 tw:xl:py-2 tw:xl:text-sm';

export type SideNavProps = { id: string; expanded: boolean };

export function SideNav({ id, expanded }: SideNavProps) {
  const { main, you } = useNavSections();
  const { tOr } = useT();

  const renderItem = (item: NavItem) => (
    <li
      key={item.id}
      className={cn(!item.onRail && 'tw:hidden', !item.onRail && expanded && 'tw:xl:block')}
    >
      <NavLink target={item.target} className={cn(ITEM, RAIL_ITEM, expanded && DRAWER_ITEM)}>
        <item.icon aria-hidden="true" className="tw:size-6 tw:shrink-0" />
        <span className="tw:truncate">{item.label}</span>
      </NavLink>
    </li>
  );

  return (
    <nav
      id={id}
      aria-label={tOr('shell.navigation', {}, '')}
      className={cn(
        'tw:sticky tw:top-18 tw:hidden tw:h-[calc(100dvh-4.5rem)] tw:w-18 tw:shrink-0 tw:flex-col tw:gap-2 tw:overflow-y-auto tw:px-1 tw:py-2 tw:md:flex',
        expanded && 'tw:xl:w-60 tw:xl:px-3'
      )}
    >
      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-1 tw:p-0">
        {main.map(renderItem)}
      </ul>
      {you.length > 0 && (
        <>
          <hr className={cn('tw:hidden tw:border-border', expanded && 'tw:xl:block')} />
          <h2
            className={cn(
              'tw:m-0 tw:hidden tw:px-3 tw:text-base tw:font-medium',
              expanded && 'tw:xl:block'
            )}
          >
            {tOr('shell.you', {}, '')}
          </h2>
          <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-1 tw:p-0">
            {you.map(renderItem)}
          </ul>
        </>
      )}
    </nav>
  );
}

export function BottomNav() {
  const { main, you } = useNavSections();
  const { tOr } = useT();
  const items = [...main, ...you].filter((item) => item.onRail);

  return (
    <nav
      aria-label={tOr('shell.navigation', {}, '')}
      className="tw:fixed tw:inset-x-0 tw:bottom-0 tw:z-10 tw:flex tw:h-14 tw:border-t tw:border-border tw:bg-bg tw:md:hidden"
    >
      <ul className="tw:m-0 tw:flex tw:flex-1 tw:list-none tw:justify-around tw:p-0">
        {items.map((item) => (
          <li key={item.id} className="tw:flex tw:flex-1">
            <NavLink
              target={item.target}
              className={cn(ITEM, 'tw:flex-1 tw:flex-col tw:justify-center tw:gap-0.5 tw:text-xs')}
            >
              <item.icon aria-hidden="true" className="tw:size-6" />
              <span className="tw:truncate">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

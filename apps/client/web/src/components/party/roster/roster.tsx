import { useT } from '@vp/intl-react';
import { Avatar, Badge, Icon, VisuallyHidden } from '@vp/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { SYNC_COPY } from './constants';
import type { RosterSource, RosterSync } from './types';

/** The People tab: who is here, grouped, with the viewer's own marks and a menu for each person. */
export function RosterRoot({ className, ...props }: ComponentPropsWithRef<'section'>) {
  const { tOr } = useT();

  return (
    <section
      data-slot="roster"
      aria-label={tOr('party.rosterTitle', {}, '')}
      className={`flex min-h-0 flex-col gap-stack overflow-y-auto p-inset-card ${className ?? ''}`}
      {...props}
    />
  );
}

export interface RosterGroupProps extends ComponentPropsWithRef<'section'> {
  label: string;
  count: number;
}

export function RosterGroup({ label, count, children, className, ...props }: RosterGroupProps) {
  return (
    <section
      data-slot="roster-group"
      className={`flex flex-col gap-inline ${className ?? ''}`}
      {...props}
    >
      <h3 className="m-0 text-label text-fg-muted">
        {label} <span aria-hidden="true">{count}</span>
        <VisuallyHidden>{count}</VisuallyHidden>
      </h3>
      <ul className="m-0 flex list-none flex-col gap-inline p-0">{children}</ul>
    </section>
  );
}

export interface RosterMemberProps extends ComponentPropsWithRef<'li'> {
  name: string;
  avatarUrl?: string | null;
  source?: RosterSource;
  owner?: boolean;
  away?: boolean;
  ready?: boolean;
  sync: RosterSync;
  /** The member's role badges, in their colours. */
  badges?: ReactNode;
  /** The member menu, at the row's end. */
  menu?: ReactNode;
}

export function RosterMember({
  name,
  avatarUrl,
  source = 'app',
  owner = false,
  away = false,
  ready = false,
  sync,
  badges,
  menu,
  className,
  ...props
}: RosterMemberProps) {
  const { tOr } = useT();

  return (
    <li
      data-slot="roster-member"
      data-away={away || undefined}
      className={`group flex items-center gap-inline ${className ?? ''}`}
      {...props}
    >
      <Avatar.Root size="sm" aria-hidden="true" className="shrink-0 group-data-away:opacity-60">
        {avatarUrl && <Avatar.Image src={avatarUrl} alt="" />}
        <Avatar.Fallback>{name.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 flex-wrap items-center gap-inline">
          <span className="truncate text-label group-data-away:opacity-60">{name}</span>
          {owner && (
            <Badge size="sm" variant="soft" tone="accent">
              {tOr('party.rosterOwnerBadge', {}, '')}
            </Badge>
          )}
          {source === 'discord_chat' && (
            <Badge size="sm" variant="soft" tone="neutral">
              {tOr('party.rosterViaDiscord', {}, '')}
            </Badge>
          )}
          {badges}
        </span>
        <span className="text-caption text-fg-muted">{tOr(SYNC_COPY[sync], {}, '')}</span>
      </div>
      {ready && <Icon name="check" size="sm" aria-label={tOr('party.rosterReadyMark', {}, '')} />}
      {menu}
    </li>
  );
}

export interface RosterRoleBadgeProps {
  name: string;
  /** The role's `#rrggbb`; it tints the badge only. */
  colour: string | null;
}

export function RosterRoleBadge({ name, colour }: RosterRoleBadgeProps) {
  return (
    <Badge
      size="sm"
      variant="outline"
      tone="neutral"
      style={colour ? { borderColor: colour, color: colour } : undefined}
    >
      {name}
    </Badge>
  );
}

/** Guests are a count, never a list. */
export function RosterGuests({ count }: { count: number }) {
  const { tOr } = useT();

  if (count === 0) {
    return null;
  }

  return (
    <p data-slot="roster-guests" className="m-0 text-body-sm text-fg-muted">
      {tOr('party.rosterGuests', { count }, '')}
    </p>
  );
}

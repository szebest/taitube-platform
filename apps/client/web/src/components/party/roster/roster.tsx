import { Avatar, Badge, Icon, IconButton, VisuallyHidden } from '@kit/ui';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { useT } from '#app/lib/messages';
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
  /** The viewer's own mark on this member, with its undo. */
  mark?: ReactNode;
  /** The viewer hides this member's avatar. */
  avatarHidden?: boolean;
  /** The viewer's favourite: highlighted. */
  favourite?: boolean;
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
  mark,
  avatarHidden = false,
  favourite = false,
  menu,
  className,
  ...props
}: RosterMemberProps) {
  const { tOr } = useT();

  return (
    <li
      data-slot="roster-member"
      data-away={away || undefined}
      data-favourite={favourite || undefined}
      className={`group flex items-center gap-inline rounded-control data-favourite:bg-tint ${className ?? ''}`}
      {...props}
    >
      <Avatar.Root size="sm" aria-hidden="true" className="shrink-0 group-data-away:opacity-60">
        {avatarUrl && !avatarHidden && <Avatar.Image src={avatarUrl} alt="" />}
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
          {mark}
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

export interface RosterControlMarkProps {
  /** Whose mark this is, for the undo's name. */
  name: string;
  kind: 'hidden' | 'muted';
  onUndo: () => void;
}

/** "Hidden by you" or "Muted for you" on a person in the viewer's own roster, with a one-click undo. */
export function RosterControlMark({ name, kind, onUndo }: RosterControlMarkProps) {
  const { tOr } = useT();

  return (
    <span data-slot="roster-control-mark" className="inline-flex items-center gap-1">
      <Badge size="sm" variant="soft" tone="neutral">
        {tOr(kind === 'hidden' ? 'party.controlMarkHidden' : 'party.controlMarkMuted', {}, '')}
      </Badge>
      <IconButton
        size="sm"
        variant="ghost"
        aria-label={tOr('party.controlMarkUndo', { name }, '')}
        onClick={onUndo}
      >
        <Icon name="close" size="sm" />
      </IconButton>
    </span>
  );
}

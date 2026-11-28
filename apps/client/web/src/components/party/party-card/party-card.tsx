import { Avatar, Badge, Icon, Progress, Slot } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import { PartyCardContext, usePartyCard } from './party-card.context';
import type { PartyCardState } from './types';

export interface PartyCardRootProps extends ComponentPropsWithRef<'article'> {
  state?: PartyCardState;
}

/** One room as a card. A full room still opens, on its full panel; an ended one dims in place and keeps its size. */
export function PartyCardRoot({ state = 'open', className, ...props }: PartyCardRootProps) {
  return (
    <PartyCardContext value={{ state }}>
      <article
        data-slot="party-card"
        data-state={state}
        className={`relative flex min-w-0 flex-col gap-stack rounded-card bg-raised p-inset-card transition-opacity data-[state=ended]:opacity-60 ${className ?? ''}`}
        {...props}
      />
    </PartyCardContext>
  );
}

export interface PartyCardThumbProps extends ComponentPropsWithRef<'div'> {
  src?: string | null;
  /** Where the video is, 0 to 1; `null` while nothing is playing. */
  progress?: number | null;
}

export function PartyCardThumb({
  src,
  progress = null,
  className,
  children,
  ...props
}: PartyCardThumbProps) {
  return (
    <div
      data-slot="party-card-thumb"
      className={`relative aspect-video overflow-hidden rounded-card bg-sunken ${className ?? ''}`}
      {...props}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span className="flex size-full items-center justify-center text-fg-muted">
          <Icon name="party" size="lg" />
        </span>
      )}
      {progress !== null && (
        <Progress
          aria-hidden="true"
          value={Math.round(progress * 100)}
          size="sm"
          className="absolute inset-x-0 bottom-0"
        />
      )}
      {children}
    </div>
  );
}

export interface PartyCardPillProps extends ComponentPropsWithRef<'span'> {
  tone?: 'accent' | 'neutral';
}

/** The phase, over the thumbnail's corner. */
export function PartyCardPill({
  tone = 'neutral',
  className,
  children,
  ...props
}: PartyCardPillProps) {
  return (
    <Badge
      data-slot="party-card-pill"
      size="sm"
      variant="soft"
      tone={tone}
      className={`absolute start-inset-card top-inset-card ${className ?? ''}`}
      {...props}
    >
      {children}
    </Badge>
  );
}

export interface PartyCardTitleProps extends ComponentPropsWithRef<'span'> {
  /** The link to the room the wrapper passes; it is stretched over the whole card. */
  asChild?: boolean;
}

export function PartyCardTitle({ asChild = false, className, ...props }: PartyCardTitleProps) {
  const { state } = usePartyCard('Title');
  const Element = asChild ? Slot.Root : 'span';

  return (
    <Element
      data-slot="party-card-title"
      data-state={state}
      className={`line-clamp-2 text-title after:absolute after:inset-0 after:content-[''] ${className ?? ''}`}
      {...props}
    />
  );
}

export interface PartyCardHostProps extends ComponentPropsWithRef<'p'> {
  name: string;
  avatarSrc?: string | null;
  /** The channel the room is hosted as: it badges the host. */
  channelBadge?: string;
}

export function PartyCardHost({
  name,
  avatarSrc,
  channelBadge,
  className,
  ...props
}: PartyCardHostProps) {
  return (
    <p
      data-slot="party-card-host"
      className={`m-0 flex min-w-0 items-center gap-inline text-body-sm text-fg-muted ${className ?? ''}`}
      {...props}
    >
      <Avatar.Root size="xs" aria-hidden="true" className="shrink-0">
        {avatarSrc && <Avatar.Image src={avatarSrc} alt="" />}
        <Avatar.Fallback>{name.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <span className="truncate">{name}</span>
      {channelBadge && (
        <Badge size="sm" variant="outline" tone="neutral">
          {channelBadge}
        </Badge>
      )}
    </p>
  );
}

export interface PartyCardRosterProps extends ComponentPropsWithRef<'div'> {
  faces: readonly { name: string; avatarUrl: string | null }[];
  /** "12 watching", counted live. */
  watching: string;
  /** What the faces leave out, one phrase each: "+3", "+2 from Discord", "+12 guests". */
  more?: readonly string[];
}

export function PartyCardRoster({
  faces,
  watching,
  more = [],
  className,
  ...props
}: PartyCardRosterProps) {
  return (
    <div
      data-slot="party-card-roster"
      className={`flex min-w-0 flex-wrap items-center gap-inline ${className ?? ''}`}
      {...props}
    >
      {faces.length > 0 && (
        <span aria-hidden="true" className="flex -space-x-2">
          {faces.map((face) => (
            <Avatar.Root
              key={`${face.name}:${face.avatarUrl}`}
              size="xs"
              className="ring-2 ring-raised"
            >
              {face.avatarUrl && <Avatar.Image src={face.avatarUrl} alt="" />}
              <Avatar.Fallback>{face.name.slice(0, 1)}</Avatar.Fallback>
            </Avatar.Root>
          ))}
        </span>
      )}
      <span className="text-label">{watching}</span>
      {more.map((phrase) => (
        <span key={phrase} className="text-caption text-fg-muted">
          {phrase}
        </span>
      ))}
    </div>
  );
}

/** The small print under the roster: the capacity, the lock, the language, the queue. */
export function PartyCardMeta({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="party-card-meta"
      className={`m-0 flex flex-wrap items-center gap-x-stack gap-y-1 text-caption text-fg-muted ${className ?? ''}`}
      {...props}
    />
  );
}

export interface PartyCardActionProps extends ComponentPropsWithRef<'span'> {
  asChild?: boolean;
}

/** What the card offers: Join, or the state that replaces it. It sits above the stretched title link. */
export function PartyCardAction({ asChild = false, className, ...props }: PartyCardActionProps) {
  const Element = asChild ? Slot.Root : 'span';

  return (
    <Element
      data-slot="party-card-action"
      className={`relative z-lift self-start ${className ?? ''}`}
      {...props}
    />
  );
}

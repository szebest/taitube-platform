import { useT } from '@vp/intl-react';
import { PartyCan } from '@vp/permissions-react';
import { Avatar, Button, Icon, VisuallyHidden } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

export interface PartyLobbyRootProps extends ComponentPropsWithRef<'div'> {
  posterUrl?: string | null;
}

/** What the stage shows before the party starts: the first item's poster and what it waits for. */
export function PartyLobbyRoot({ posterUrl, className, children, ...props }: PartyLobbyRootProps) {
  return (
    <div
      data-slot="party-lobby"
      className={`relative flex aspect-video w-full flex-col items-center justify-center gap-stack overflow-hidden rounded-thumb bg-bg text-fg ${className ?? ''}`}
      {...props}
    >
      {posterUrl && (
        <img
          src={posterUrl}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-40"
        />
      )}
      <div className="relative z-10 flex flex-col items-center gap-stack p-inset-card text-center">
        {children}
      </div>
    </div>
  );
}

/** "Waiting to start", or the scheduled start. */
export function PartyLobbyStatus({ startsAt }: { startsAt?: string }) {
  const { tOr } = useT();

  return (
    <p data-slot="party-lobby-status" className="m-0 text-title">
      {startsAt
        ? tOr('party.lobbyScheduled', { time: startsAt }, '')
        : tOr('party.phaseLobby', {}, '')}
    </p>
  );
}

/** The seconds left of Start's countdown, in a polite live region. */
export function PartyLobbyCountdown({ seconds }: { seconds: number }) {
  const { tOr } = useT();

  return (
    <p
      data-slot="party-lobby-countdown"
      role="timer"
      aria-live="polite"
      className="m-0 text-display"
    >
      {tOr('party.stageCountdown', { seconds }, '')}
    </p>
  );
}

export interface PartyLobbyMember {
  key: string;
  name: string;
  avatarUrl: string | null;
  ready: boolean;
}

export interface PartyLobbyReadyCheckProps {
  members: readonly PartyLobbyMember[];
  /** Guests are a count, never a face. */
  guests?: number;
}

/** The roster as an avatar grid with a tick on each member who is ready, and "4 of 6 ready". */
export function PartyLobbyReadyCheck({ members, guests = 0 }: PartyLobbyReadyCheckProps) {
  const { tOr } = useT();
  const ready = members.filter((member) => member.ready).length;

  return (
    <div data-slot="party-lobby-ready-check" className="flex flex-col items-center gap-inline">
      <ul className="m-0 flex list-none flex-wrap justify-center gap-inline p-0">
        {members.map((member) => (
          <li key={member.key} className="relative">
            <Avatar.Root size="md" aria-hidden="true">
              {member.avatarUrl && <Avatar.Image src={member.avatarUrl} alt="" />}
              <Avatar.Fallback>{member.name.slice(0, 1)}</Avatar.Fallback>
            </Avatar.Root>
            <VisuallyHidden>{member.name}</VisuallyHidden>
            {member.ready && (
              <Icon
                name="check"
                size="sm"
                aria-label={tOr('party.rosterReadyMark', {}, '')}
                className="absolute -end-1 -bottom-1 rounded-full bg-success text-on-accent"
              />
            )}
          </li>
        ))}
      </ul>
      <p className="m-0 text-body-sm">
        {tOr('party.rosterReady', { ready, total: members.length }, '')}
        {guests > 0 && ` · ${tOr('party.rosterGuests', { count: guests }, '')}`}
      </p>
    </div>
  );
}

export interface PartyLobbyActionsProps {
  ready: boolean;
  onToggleReady: () => void;
  onStart: () => void;
}

/** Everyone toggles their own ready mark; Start is for those who hold `playback.control`. */
export function PartyLobbyActions({ ready, onToggleReady, onStart }: PartyLobbyActionsProps) {
  const { tOr } = useT();

  return (
    <div data-slot="party-lobby-actions" className="flex flex-wrap justify-center gap-inline">
      <Button variant={ready ? 'soft' : 'solid'} aria-pressed={ready} onClick={onToggleReady}>
        {ready ? tOr('party.stageNotReady', {}, '') : tOr('party.stageReady', {}, '')}
      </Button>
      <PartyCan gate={{ permission: 'playback.control' }}>
        <Button tone="accent" variant="solid" onClick={onStart}>
          {tOr('party.stageStart', {}, '')}
        </Button>
      </PartyCan>
    </div>
  );
}

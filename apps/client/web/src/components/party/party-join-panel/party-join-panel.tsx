import { useT } from '@vp/intl-react';
import { Avatar, Button, Field, Input } from '@vp/ui';
import { type ComponentPropsWithRef, type SubmitEvent, useState } from 'react';
import { PASSWORD_ERROR_COPY, STATE_NOTICE } from './constants';
import type { PartyJoinAction, PartyJoinState, PartyPasswordError } from './types';

export interface PartyJoinPanelProps extends Omit<ComponentPropsWithRef<'section'>, 'children'> {
  state: PartyJoinState;
  name: string;
  ownerName: string;
  videoTitle?: string | null;
  posterUrl?: string | null;
  /** Up to five faces, then `total` counts everyone. */
  faces?: readonly { name: string; avatarUrl: string | null }[];
  total?: number;
  /** What a visitor with no seat may do, as the room's preview lists them. */
  actions?: readonly PartyJoinAction[];
  /** A full room: who is in it and how many it holds. */
  full?: { present: number; capacity: number };
  passwordError?: PartyPasswordError | null;
  pending?: boolean;
  onJoin: (password?: string) => void;
  onWatchAsGuest: () => void;
  /** Joining with Discord; left out where that integration is not configured. */
  onDiscord?: () => void;
  onSignIn: () => void;
  /** Leaves the room for the video alone, offered when the room is full. */
  onWatchAlone?: () => void;
}

/** What a visitor with no seat sees: the room, and the one thing between them and it. */
export function PartyJoinPanel({
  state,
  name,
  ownerName,
  videoTitle,
  posterUrl,
  faces = [],
  total = 0,
  actions = [],
  full,
  passwordError = null,
  pending = false,
  onJoin,
  onWatchAsGuest,
  onDiscord,
  onSignIn,
  onWatchAlone,
  className,
  ...props
}: PartyJoinPanelProps) {
  const { tOr } = useT();
  const [password, setPassword] = useState('');
  const notice =
    state in STATE_NOTICE ? STATE_NOTICE[state as keyof typeof STATE_NOTICE] : undefined;
  const joinable = state === 'yes' || state === 'password';
  const showRoom = state !== 'not_found';

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onJoin(password);
  };

  return (
    <section
      data-slot="party-join-panel"
      data-state={state}
      aria-label={name}
      className={`mx-auto flex w-full max-w-prose flex-col gap-stack rounded-card bg-surface p-inset-card text-fg ${className ?? ''}`}
      {...props}
    >
      {showRoom && (
        <>
          {posterUrl && (
            <img
              src={posterUrl}
              alt=""
              className="aspect-video w-full rounded-thumb object-cover"
            />
          )}
          <div className="flex flex-col gap-inline">
            <h1 className="m-0 text-title-lg">{name}</h1>
            <p className="m-0 text-body-sm text-fg-muted">
              {tOr('party.ownerBy', { name: ownerName }, '')}
              {videoTitle && ` · ${videoTitle}`}
            </p>
          </div>
          {total > 0 && (
            <div className="flex items-center gap-inline">
              <ul className="m-0 flex list-none gap-1 p-0">
                {faces.map((face) => (
                  <li key={`${face.name}:${face.avatarUrl}`}>
                    <Avatar.Root size="sm" aria-hidden="true">
                      {face.avatarUrl && <Avatar.Image src={face.avatarUrl} alt="" />}
                      <Avatar.Fallback>{face.name.slice(0, 1)}</Avatar.Fallback>
                    </Avatar.Root>
                  </li>
                ))}
              </ul>
              <span className="text-body-sm text-fg-muted">
                {tOr('party.roomPresent', { count: total }, '')}
              </span>
            </div>
          )}
        </>
      )}
      {notice && <p className="m-0 text-body">{tOr(notice, {}, '')}</p>}
      {state === 'full' && full && (
        <p className="m-0 text-body">
          {tOr('party.fullTitle', { present: full.present, capacity: full.capacity }, '')}
        </p>
      )}
      {state === 'password' && (
        <form className="flex flex-col gap-inline" onSubmit={handleSubmit}>
          <Field.Root invalid={passwordError !== null}>
            <Field.Label>{tOr('party.previewPassword', {}, '')}</Field.Label>
            <Input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {passwordError && (
              <Field.Error>{tOr(PASSWORD_ERROR_COPY[passwordError], {}, '')}</Field.Error>
            )}
          </Field.Root>
          <Button
            type="submit"
            tone="accent"
            variant="solid"
            disabled={pending || passwordError === 'locked' || password === ''}
          >
            {tOr('party.previewJoin', {}, '')}
          </Button>
        </form>
      )}
      <div className="flex flex-wrap gap-inline">
        {state === 'yes' && actions.length === 0 && (
          <Button tone="accent" variant="solid" disabled={pending} onClick={() => onJoin()}>
            {tOr('party.previewJoin', {}, '')}
          </Button>
        )}
        {state === 'full' && (
          <Button tone="accent" variant="solid" disabled>
            {tOr('party.previewJoin', {}, '')}
          </Button>
        )}
        {(joinable || state === 'guests_off') && actions.includes('guest') && (
          <Button tone="accent" variant="solid" disabled={pending} onClick={onWatchAsGuest}>
            {tOr('party.previewWatchAsGuest', {}, '')}
          </Button>
        )}
        {actions.includes('discord') && onDiscord && (
          <Button variant="soft" onClick={onDiscord}>
            {tOr('party.previewJoinWithDiscord', {}, '')}
          </Button>
        )}
        {actions.includes('sign_in') && (
          <Button variant="soft" onClick={onSignIn}>
            {tOr('party.previewSignIn', {}, '')}
          </Button>
        )}
        {state === 'full' && onWatchAlone && (
          <Button variant="ghost" onClick={onWatchAlone}>
            {tOr('party.previewWatchOnYourOwn', {}, '')}
          </Button>
        )}
      </div>
    </section>
  );
}

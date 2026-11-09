import type { WatchPartyClientFrame } from '@vp/api-contracts';
import { expectedPositionMs } from '@vp/domain';
import { useT } from '@vp/intl-react';
import { usePartyCan } from '@vp/permissions-react';
import type { PartyRequest, WatchPartySocket } from '@vp/queries';
import { Button, Icon } from '@vp/ui';

const MS_PER_SECOND = 1000;

interface PartyControlsProps {
  socket: WatchPartySocket;
}

type Versioned = { version: number; rolesVersion: number };

function acceptFrame(request: PartyRequest, versions: Versioned): WatchPartyClientFrame {
  switch (request.kind) {
    case 'seek':
      return { type: 'seek', positionMs: request.positionMs ?? 0, ...versions };
    case 'skip':
      return { type: 'next', ...versions };
    case 'start':
      return { type: 'start', ...versions };
  }
}

/** Who may play, pause and start, and what someone without that may ask for. */
export function PartyControls({ socket }: PartyControlsProps) {
  const { state, serverNow, send, dismissRequest } = socket;
  const { tOr } = useT();
  const canControl = usePartyCan({ kind: 'permission', permission: 'playback.control' });
  const canRequest = usePartyCan({ kind: 'permission', permission: 'playback.request' });
  const { playback, version, rolesVersion } = state;
  const versions = { version, rolesVersion };
  const playing = playback.phase === 'playing';
  const lobby = playback.phase === 'lobby';

  const nameOf = (memberKey: string) =>
    state.roster.find((person) => person.memberKey === memberKey)?.name ?? memberKey;

  const toggle = () =>
    send(
      playing
        ? { type: 'pause', positionMs: expectedPositionMs(playback, serverNow()), ...versions }
        : { type: 'play', ...versions }
    );

  const requestText = (request: PartyRequest) => {
    const name = nameOf(request.from);
    switch (request.kind) {
      case 'seek':
        return tOr(
          'party.requestsSeek',
          { name, time: `${Math.floor((request.positionMs ?? 0) / MS_PER_SECOND)}s` },
          ''
        );
      case 'skip':
        return tOr('party.requestsSkip', { name }, '');
      case 'start':
        return tOr('party.requestsStart', { name }, '');
    }
  };

  return (
    <div data-slot="party-controls" className="flex flex-col gap-inline">
      <div className="flex flex-wrap items-center gap-inline">
        {canControl && !lobby && (
          <Button size="sm" variant="soft" onClick={toggle}>
            <Icon name={playing ? 'pause' : 'play'} size="sm" />
            {playing ? tOr('party.phasePaused', {}, '') : tOr('party.phasePlaying', {}, '')}
          </Button>
        )}
        {!canControl && (
          <p className="m-0 text-body-sm text-fg-muted">
            {tOr('party.stageCannotControl', {}, '')}
          </p>
        )}
        {!canControl && canRequest && (
          <Button
            size="sm"
            variant="soft"
            onClick={() => send({ type: 'request', kind: lobby ? 'start' : 'skip' })}
          >
            {tOr('party.stageRequest', {}, '')}
          </Button>
        )}
      </div>
      {canControl && (
        <ul className="m-0 flex list-none flex-col gap-inline p-0" aria-live="polite">
          {state.requests.map((request) => (
            <li key={request.key} className="flex flex-wrap items-center gap-inline text-body-sm">
              <span>{requestText(request)}</span>
              <Button
                size="sm"
                tone="accent"
                variant="solid"
                onClick={() => {
                  send(acceptFrame(request, versions));
                  dismissRequest(request.key);
                }}
              >
                {tOr('party.requestsAccept', {}, '')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dismissRequest(request.key)}>
                {tOr('party.requestsDismiss', {}, '')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

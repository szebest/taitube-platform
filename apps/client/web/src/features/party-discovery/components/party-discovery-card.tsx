import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { Badge, Button, Icon } from '@kit/ui';
import { Link } from '@tanstack/react-router';
import type { WatchPartyCardView } from '@vp/api-contracts';
import { useState } from 'react';
import { PartyCard } from '#app/components/party/party-card';
import { useT } from '#app/lib/messages';
import { isFull, pillOf, progressOf } from '../utils/party-card-model';

export interface PartyDiscoveryCardProps {
  card: WatchPartyCardView;
  /** The room closed while the page was open: the card keeps its place and says so. */
  ended: boolean;
  /** The browser clock, ticking once a second for the whole grid. */
  now: number;
}

/** A listed room: its video and progress, its host and roster, and the one thing to do next. */
export function PartyDiscoveryCard({ card, ended, now }: PartyDiscoveryCardProps) {
  const { tOr } = useT();
  const { format } = useFormat();
  const [serverOffsetMs] = useState(() => card.serverNow - Date.now());
  const full = isFull(card);
  const pill = pillOf(card, now);
  const { roster, currentVideo } = card;

  const pillText = (() => {
    switch (pill.kind) {
      case 'now':
        return tOr('party.phasePlaying', {}, '');
      case 'lobby':
        return tOr('party.phaseLobby', {}, '');
      case 'finished':
        return tOr('party.phaseFinished', {}, '');
      case 'scheduled': {
        const time = unwrapOr(
          format({ type: 'time', value: pill.at.toISOString(), options: { style: 'short' } }),
          ''
        );
        return tOr('party.discoveryStartsAt', { time }, '');
      }
    }
  })();

  const more = [
    ...(roster.others > 0 ? [tOr('party.discoveryOthers', { count: roster.others }, '')] : []),
    ...(roster.discord > 0
      ? [tOr('party.discoveryFromDiscord', { count: roster.discord }, '')]
      : []),
    ...(roster.guests > 0 ? [tOr('party.discoveryGuests', { count: roster.guests }, '')] : []),
  ];

  return (
    <PartyCard.Root state={ended ? 'ended' : full ? 'full' : 'open'}>
      <PartyCard.Thumb
        src={currentVideo?.thumbnailUrl}
        progress={pill.kind === 'now' ? progressOf(card, now, serverOffsetMs) : null}
      >
        <PartyCard.Pill tone={pill.kind === 'now' ? 'accent' : 'neutral'}>
          {pillText}
        </PartyCard.Pill>
      </PartyCard.Thumb>
      <PartyCard.Title asChild>
        <Link to="/parties/$roomId" params={{ roomId: card.id }}>
          {card.name}
        </Link>
      </PartyCard.Title>
      <PartyCard.Host
        name={card.owner.name}
        avatarSrc={card.owner.avatarUrl}
        channelBadge={
          card.channel
            ? tOr('party.discoveryHostedBy', { name: card.channel.displayName }, '')
            : undefined
        }
      />
      <PartyCard.Roster
        faces={roster.faces}
        watching={tOr('party.discoveryWatching', { count: card.presentCount }, '')}
        more={more}
      />
      <PartyCard.Meta>
        {card.capacity !== null && (
          <span>
            {tOr(
              'party.discoveryCapacity',
              { present: card.presentCount, capacity: card.effectiveCapacity },
              ''
            )}
          </span>
        )}
        {card.hasPassword && (
          <span className="inline-flex items-center gap-1">
            <Icon name="lock" size="sm" aria-label={tOr('party.discoveryLocked', {}, '')} />
          </span>
        )}
        {card.language && <span>{card.language.toUpperCase()}</span>}
        {card.queueLength > 1 && (
          <span>{tOr('party.discoveryPlaylist', { count: card.queueLength }, '')}</span>
        )}
        {currentVideo === null && <span>{tOr('party.discoveryNoVideo', {}, '')}</span>}
      </PartyCard.Meta>
      <PartyCard.Action asChild={!ended && !full}>
        {ended ? (
          <Badge size="sm" variant="soft" tone="neutral">
            {tOr('party.discoveryEnded', {}, '')}
          </Badge>
        ) : full ? (
          <Badge size="sm" variant="soft" tone="neutral">
            {tOr('party.discoveryFull', {}, '')}
          </Badge>
        ) : (
          <Button asChild size="sm" variant="soft">
            <Link to="/parties/$roomId" params={{ roomId: card.id }}>
              {tOr('party.discoveryJoin', {}, '')}
            </Link>
          </Button>
        )}
      </PartyCard.Action>
    </PartyCard.Root>
  );
}

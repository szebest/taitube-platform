import type { WatchPartyCardView } from '@vp/api-contracts';
import { expectedPositionMs, WATCH_PARTY_SIZE_LIMITS } from '@vp/domain';
import type { PartyDiscoveryFilters } from '@vp/queries';

export type PartyPill =
  | { kind: 'now' }
  | { kind: 'lobby' }
  | { kind: 'finished' }
  | { kind: 'scheduled'; at: Date };

/** What the phase pill says: a scheduled room names its start, a paused one is still on air. */
export function pillOf(
  card: Pick<WatchPartyCardView, 'phase' | 'scheduledFor'>,
  now: number
): PartyPill {
  switch (card.phase) {
    case 'playing':
    case 'paused':
      return { kind: 'now' };
    case 'finished':
      return { kind: 'finished' };
    case 'lobby': {
      const at = card.scheduledFor === null ? null : new Date(card.scheduledFor);
      return at !== null && at.getTime() > now ? { kind: 'scheduled', at } : { kind: 'lobby' };
    }
  }
}

export function isFull(
  card: Pick<WatchPartyCardView, 'presentCount' | 'effectiveCapacity'>
): boolean {
  return card.presentCount >= card.effectiveCapacity;
}

/**
 * How far into its video the room is, from the clock snapshot the card came with. `serverOffsetMs` is
 * the server's clock minus the browser's at the moment the page was read, so the bar moves without
 * a push.
 */
export function progressOf(
  card: Pick<WatchPartyCardView, 'playback' | 'currentVideo'>,
  localNow: number,
  serverOffsetMs: number
): number | null {
  const duration = card.currentVideo?.durationMs ?? null;
  if (duration === null || duration <= 0 || card.playback.itemId === null) return null;
  const position = expectedPositionMs(card.playback, localNow + serverOffsetMs);
  return Math.min(1, Math.max(0, position / duration));
}

function sizeOf(present: number): PartyDiscoveryFilters['size'] {
  const { small, medium } = WATCH_PARTY_SIZE_LIMITS;
  if (present <= small) return 'small';
  return present <= medium ? 'medium' : 'large';
}

/**
 * Whether a room pushed over the stream belongs in the view: every filter the card carries. The text
 * search and "followed" need the server, so a view that uses either never matches a pushed room.
 */
export function matchesFilters(
  card: WatchPartyCardView,
  filters: PartyDiscoveryFilters,
  now: number
): boolean {
  if (filters.q || filters.followed) return false;
  const pill = pillOf(card, now).kind;
  const statusOf = { now: 'now', lobby: 'lobby', scheduled: 'scheduled', finished: undefined }[
    pill
  ];
  return (
    (filters.status === 'all' || filters.status === statusOf) &&
    (!filters.category || card.currentVideo?.categoryId === filters.category) &&
    (!filters.language || card.language === filters.language) &&
    (filters.access === 'any' || (filters.access === 'password') === card.hasPassword) &&
    (filters.size === 'any' || filters.size === sizeOf(card.presentCount)) &&
    (!filters.space || !isFull(card)) &&
    (!filters.creator || card.channel !== null) &&
    (filters.kind === 'any' || (filters.kind === 'playlist') === card.queueLength > 1)
  );
}

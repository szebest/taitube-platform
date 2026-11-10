import type { WatchPartyState } from '@vp/queries';
import { partyHello } from '@vp/web-testing';

/** The state a member's page is in right after `hello`, with `overrides` on top. */
export function partyState(overrides: Partial<WatchPartyState> = {}): WatchPartyState {
  const hello = partyHello();
  if (hello.type !== 'hello') {
    throw new Error('partyHello must be a hello frame');
  }

  return {
    connection: 'open',
    ended: null,
    room: hello.room,
    roles: hello.roles,
    rolesVersion: hello.rolesVersion,
    you: hello.you,
    expiries: {},
    playback: hello.playback,
    version: hello.version,
    queue: hello.queue,
    votes: null,
    countdownEndsAt: null,
    roster: hello.roster.entries,
    guests: hello.roster.guests,
    lines: [],
    pinned: hello.chat.pinned,
    chatMode: hello.chat.mode,
    requests: [],
    refusal: null,
    ...overrides,
  };
}

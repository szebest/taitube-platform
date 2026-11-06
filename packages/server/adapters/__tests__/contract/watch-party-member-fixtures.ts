import type { NewWatchPartyMember } from '@vp/core/repositories';
import type { WatchPartyBan } from '@vp/domain';
import { OTHER_OWNER_ID } from './fixtures';
import { GUEST_KEY, later, OTHER_KEY, OWNER_KEY, ROOM_ID } from './watch-party-fixtures';

export const OTHER_GUEST_KEY = 'guest:qrstuvwxyzabcdef';
export const IP_HASH = 'ip-hash-1';

export const accountSeat = (overrides: Partial<NewWatchPartyMember> = {}): NewWatchPartyMember => ({
  roomId: ROOM_ID,
  memberKey: OTHER_KEY,
  kind: 'user',
  userId: OTHER_OWNER_ID,
  discordUserId: null,
  displayName: null,
  avatarUrl: null,
  joinedVia: 'link',
  joinedAt: later(1),
  ...overrides,
});

export const guestSeat = (memberKey = GUEST_KEY, joinedAt = later(2)): NewWatchPartyMember =>
  accountSeat({
    memberKey,
    kind: 'guest',
    userId: null,
    displayName: 'Guest 4821',
    joinedVia: 'link',
    joinedAt,
  });

export const banOf = (overrides: Partial<WatchPartyBan> = {}): WatchPartyBan => ({
  roomId: ROOM_ID,
  memberKey: GUEST_KEY,
  ipHash: IP_HASH,
  bannedBy: OWNER_KEY,
  reason: 'spam',
  createdAt: later(3),
  ...overrides,
});

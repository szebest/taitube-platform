import type { RosterEntry } from '@vp/domain';
import { flushRoster, rosterPatchFor } from '../watch-party-roster-feed';
import { GUEST_KEY, ROOM_ID, seatGuest } from './watch-party-moderation-fixture';
import { socketRoom } from './watch-party-socket-fixture';

const entry = (
  memberKey: string,
  overrides: Partial<Omit<RosterEntry, 'roleIds'>> = {}
): RosterEntry & { roleIds: string[] } => ({
  memberKey,
  kind: memberKey.startsWith('guest:') ? 'guest' : 'user',
  source: 'app',
  name: memberKey,
  avatarUrl: null,
  roleIds: [],
  ready: false,
  sync: 'in_sync',
  voice: 'off',
  away: false,
  ...overrides,
});

describe('the roster feed', () => {
  it('publishes one patch per window, the latest change per member, with the guest count', async () => {
    const party = await socketRoom();
    await seatGuest(party.repositories, party.deps.now());

    await flushRoster(party.deps)(ROOM_ID, [
      { type: 'upsert', entry: entry('user:a') },
      { type: 'upsert', entry: entry('user:a', { ready: true }) },
      { type: 'upsert', entry: entry('user:b') },
      { type: 'removal', memberKey: 'user:b' },
    ]);

    expect(party.published('roster.patch')).toEqual([
      {
        type: 'roster.patch',
        upserts: [entry('user:a', { ready: true })],
        removals: ['user:b'],
        guests: 1,
      },
    ]);
  });

  it.each([
    { holder: 'a holder of members.kick', seesGuests: true, upserts: 2, removals: 2 },
    { holder: 'anyone else', seesGuests: false, upserts: 1, removals: 1 },
  ])('shows guests one by one only to $holder', ({ seesGuests, upserts, removals }) => {
    const patch = rosterPatchFor(
      {
        type: 'roster.patch',
        upserts: [entry('user:a'), entry(GUEST_KEY)],
        removals: ['user:b', 'guest:qrstuvwxyzabcdef'],
        guests: 2,
      },
      seesGuests
    );

    expect([patch.upserts.length, patch.removals.length, patch.guests]).toEqual([
      upserts,
      removals,
      2,
    ]);
  });
});
